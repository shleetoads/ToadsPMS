import { NextResponse } from 'next/server';
import { withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { Receive } from '@/types/inventory/receive/receive';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items : Receive[] = body;

    const count = await withTransaction(async (client) => {
      let total = 0;
      for (const item of items) {
        const queryString =
        `merge receive as a
        using (select @vesselNo as vessel_no
                    , @receiveNo as receive_no
                    , @materialCode as material_code
                    , @receiveDate as receive_date
                    , @deliveryLocation as delivery_location
                    , @receiveType as receive_type
                    , @receiveUnit as receive_unit
                    , @receiveQty as receive_qty
                    , @receiveLocation as receive_location
                    , @receiveRemark as receive_remark
                    , @registDate as regist_date
                    , @registUser as regist_user
                    , @modifyDate as modify_date
                    , @modifyUser as modify_user) as b
            on (a.vessel_no = b.vessel_no
            and a.receive_no = b.receive_no)
          when matched then
              update
                  set material_code = b.material_code
                    , receive_date = b.receive_date
                    , delivery_location = b.delivery_location
                    , receive_type = b.receive_type
                    , receive_unit = b.receive_unit
                    , receive_qty = b.receive_qty
                    , receive_location = b.receive_location
                    , receive_remark = b.receive_remark
                    , last_receive_date = now()::timestamp
                    , modify_date = b.modify_date
                    , modify_user = b.modify_user
          when not matched then
              insert (vessel_no
                    , receive_no
                    , material_code
                    , receive_date
                    , delivery_location
                    , receive_type
                    , receive_unit
                    , receive_qty
                    , receive_location
                    , receive_remark
                    , last_receive_date
                    , regist_date
                    , regist_user)
              values (b.vessel_no
                    , b.receive_no
                    , b.material_code
                    , b.receive_date
                    , b.delivery_location
                    , b.receive_type
                    , b.receive_unit
                    , b.receive_qty
                    , b.receive_location
                    , b.receive_remark
                    , now()::timestamp
                    , b.regist_date
                    , b.regist_user);`;

        const params: NamedParam[] = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'receiveNo', value: item.receive_no },
          { name: 'materialCode', value: item.material_code },
          { name: 'receiveDate', value: item.receive_date },
          { name: 'deliveryLocation', value: item.delivery_location },
          { name: 'receiveType', value: item.receive_type },
          { name: 'receiveUnit', value: item.receive_unit },
          { name: 'receiveQty', value: item.receive_qty },
          { name: 'receiveLocation', value: item.receive_location },
          { name: 'receiveRemark', value: item.receive_remark },
          { name: 'registDate', value: item.regist_date },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyDate', value: item.modify_date },
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

    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
