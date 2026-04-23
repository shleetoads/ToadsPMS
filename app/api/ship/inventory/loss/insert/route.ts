import { NextResponse } from 'next/server';
import { query, withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { Loss } from '@/types/inventory/loss/loss';

export async function POST(req: Request) {
  try {
    const remoteSiteUrl = process.env.REMOTE_SITE_URL;
    const body = await req.json();
    const items : Loss[] = body;

    const count = await withTransaction(async (client) => {
      let total = 0;
      for (const item of items) {
        const queryString = `
        insert into loss (
               vessel_no
             , loss_no
             , material_code
             , loss_date
             , loss_type
             , loss_unit
             , loss_qty
             , loss_location
             , loss_reason
             , regist_date
             , regist_user
        )
        values (
                @vesselNo
              , (select 'L0' || to_char(now(), 'YYMM') || lpad((coalesce(right(max(loss_no), 3)::int, 0) + 1)::text, 3, '0')
                   from loss
                  where vessel_no = @vesselNo)
              , @materialCode
              , @lossDate
              , 'L0'
              , @lossUnit
              , @lossQty
              , @lossLocation
              , @lossReason
              , now()::timestamp
              , @registUser
        );`;

        const params: NamedParam[] = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'materialCode', value: item.material_code },
          { name: 'lossDate', value: item.loss_date },
          { name: 'lossUnit', value: item.loss_unit },
          { name: 'lossQty', value: item.loss_qty },
          { name: 'lossLocation', value: item.loss_location },
          { name: 'lossReason', value: item.loss_reason },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyUser', value: item.modify_user },
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

    // 저장된 정비 정보 조회
    const sendData: Loss[] = await query(
      `select vessel_no
            , loss_no
            , material_code
            , loss_date
            , loss_type
            , loss_unit
            , loss_qty
            , loss_location
            , loss_reason
            , regist_date
            , regist_user
         from loss
        where vessel_no = @vesselNo
          and regist_user = @registUser
          and regist_date >= to_char(now()::timestamp, 'YYYY-MM-DD');`,
      [
        { name: 'vesselNo', value: items[0].vessel_no },
        { name: 'registUser', value: items[0].regist_user },
      ]
    );

    // 선박에서 저장된 정비 정보 전송
    if (sendData[0]) {
      const fetchResponse = await fetch(`${remoteSiteUrl}/api/data/inventory/loss/sets`, {
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
                `update loss
                    set last_send_date = now()::timestamp
                  where vessel_no = @vesselNo
                    and loss_no = @lossNo;`

              const params: NamedParam[] = [
                { name: 'vesselNo', value: item.vessel_no },
                { name: 'lossNo', value: item.loss_no },
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
