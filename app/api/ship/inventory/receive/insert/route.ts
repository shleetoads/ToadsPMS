import { NextResponse } from 'next/server';
import { query, withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { ReceiveData } from '@/types/inventory/receive/receive_data';
import { Receive } from '@/types/inventory/receive/receive';

export async function POST(req: Request) {
  try {
    const remoteSiteUrl = process.env.REMOTE_SITE_URL;
    const body = await req.json();
    const receiveData : ReceiveData = body;

    const count = await withTransaction(async (client) => {
      let total = 0;
      for (const item of receiveData.materials) {
        const queryString = `
        insert into receive (
               vessel_no
             , receive_no
             , material_code
             , receive_date
             , delivery_location
             , receive_type
             , receive_unit
             , receive_qty
             , receive_location
             , receive_remark
             , regist_date
             , regist_user
        )
        values (
               @vesselNo
             , (select 'I0' || to_char(now(), 'YYMM') || lpad((coalesce(right(max(receive_no), 3)::int, 0) + 1)::text, 3, '0')
                  from receive
                 where vessel_no = @vesselNo
                   and receive_type = 'I0')
             , @materialCode
             , @receiveDate
             , @deliveryLocation
             , 'I0'
             , (select material_unit
                  from material
                 where vessel_no = @vesselNo
                   and material_code = @materialCode)
             , @receiveQty
             , @receiveLocation
             , @receiveRemark
             , now()::timestamp
             , @registUser
        );`;

        const params: NamedParam[] = [
          { name: 'vesselNo', value: receiveData.vessel_no },
          { name: 'materialCode', value: item.material_code },
          { name: 'receiveDate', value: receiveData.receive_date },
          { name: 'deliveryLocation', value: receiveData.delivery_location },
          { name: 'receiveType', value: item.receive_type },
          { name: 'receiveQty', value: item.receive_qty },
          { name: 'receiveLocation', value: item.delivery_location },
          { name: 'receiveRemark', value: item.receive_remark },
          { name: 'registUser', value: receiveData.regist_user },
          { name: 'modifyUser', value: receiveData.modify_user },
        ];

        const { text, values } = adaptNamedParams(queryString, params);
        const result = await client.query(text, values);
        total += result.rowCount ?? 0;
      }
      return total;
    });

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
    }

    // 저장된 입고 정보 조회
    const sendData: Receive[] = await query(
      `select vessel_no
            , receive_no
            , material_code
            , receive_date
            , receive_location
            , receive_type
            , receive_unit
            , receive_qty
            , receive_remark
            , delivery_location
            , regist_date
            , regist_user
         from receive
        where vessel_no = @vesselNo
          and regist_user = @registUser
          and regist_date >= current_date;`,
      [
        { name: 'vesselNo', value: receiveData.vessel_no },
        { name: 'registUser', value: receiveData.regist_user },
      ]
    );

    // 선박에서 저장된 정비 정보 전송
    if (sendData[0]) {

      const fetchResponse = await fetch(`${remoteSiteUrl}/api/data/inventory/receive/sets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendData),
      });

      if (fetchResponse.ok) {
        // 정비 정보의 마지막 전송일자 수정
        try {
          await withTransaction(async (client) => {
            for (const item of sendData) {
              const queryString =
                `update receive
                    set last_send_date = now()::timestamp
                  where vessel_no = @vesselNo
                    and receive_no = @receiveNo;`

              const params: NamedParam[] = [
                { name: 'vesselNo', value: item.vessel_no },
                { name: 'receiveNo', value: item.receive_no },
              ];

              const { text, values } = adaptNamedParams(queryString, params);
              await client.query(text, values);
            }
          });
        } catch (err) {
          console.error(err);
          return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
        }
      }
    }
    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
