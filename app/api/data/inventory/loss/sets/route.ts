import { NextResponse } from 'next/server';
import { withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { Loss } from '@/types/inventory/loss/loss';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items : Loss[] = body;

    const count = await withTransaction(async (client) => {
      let total = 0;
      for (const item of items) {
        const queryString =
        `merge loss as a
        using (select @vesselNo as vessel_no
                    , @lossNo as loss_no
                    , @materialCode as material_code
                    , @lossDate as loss_date
                    , @lossType as loss_type
                    , @lossUnit as loss_unit
                    , @lossQty as loss_qty
                    , @lossLocation as loss_location
                    , @lossReason as loss_reason
                    , @registDate as regist_date
                    , @registUser as regist_user
                    , @modifyDate as modify_date
                    , @modifyUser as modify_user) as b
            on (a.vessel_no = b.vessel_no
            and a.loss_no = b.loss_no)
          when matched then
              update
                  set material_code = b.material_code
                    , loss_date = b.loss_date
                    , loss_type = b.loss_type
                    , loss_unit = b.loss_unit
                    , loss_qty = b.loss_qty
                    , loss_location = b.loss_location
                    , loss_reason = b.loss_reason
                    , last_receive_date = now()::timestamp
                    , modify_date = b.modify_date
                    , modify_user = b.modify_user
          when not matched then
              insert (vessel_no
                    , loss_no
                    , material_code
                    , loss_date
                    , loss_type
                    , loss_unit
                    , loss_qty
                    , loss_location
                    , loss_reason
                    , last_receive_date
                    , regist_date
                    , regist_user)
              values (b.vessel_no
                    , b.loss_no
                    , b.material_code
                    , b.loss_date
                    , b.loss_type
                    , b.loss_unit
                    , b.loss_qty
                    , b.loss_location
                    , b.loss_reason
                    , now()::timestamp
                    , b.regist_date
                    , b.regist_user);`;

        const params: NamedParam[] = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'lossNo', value: item.loss_no },
          { name: 'materialCode', value: item.material_code },
          { name: 'lossDate', value: item.loss_date },
          { name: 'lossType', value: item.loss_type },
          { name: 'lossUnit', value: item.loss_unit },
          { name: 'lossQty', value: item.loss_qty },
          { name: 'lossLocation', value: item.loss_location },
          { name: 'lossReason', value: item.loss_reason },
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
