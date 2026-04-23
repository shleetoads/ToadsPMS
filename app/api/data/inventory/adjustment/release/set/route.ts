import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { Adjustment } from '@/types/inventory/adjustment/adjustment';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item : Adjustment = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `merge "release" as a
       using (select @vesselNo as vessel_no
                   , @adjustmentNo as release_no
                   , @materialCode as material_code
                   , @adjustmentDate as release_date
                   , @adjustmentType as release_type
                   , @adjustmentUnit as release_unit
                   , @adjustmentQty as release_qty
                   , @adjustmentLocation as release_location
                   , @adjustmentReason as release_reason
                   , @registDate as regist_date
                   , @registUser as regist_user
                   , @modifyDate as modify_date
                   , @modifyUser as modify_user) as b
          on (a.vessel_no = b.vessel_no 
          and a.release_no = b.release_no)
        when matched then
             update
                set material_code = b.material_code
                  , release_date = b.release_date
                  , release_type = b.release_type
                  , release_unit = b.release_unit
                  , release_qty = b.release_qty
                  , release_location = b.release_location
                  , release_reason = b.release_reason
                  , last_receive_date = now()::timestamp
                  , modify_date = b.modify_date
                  , modify_user = b.modify_user
        when not matched then
             insert (vessel_no
                   , release_no
                   , material_code
                   , release_date
                   , release_type
                   , release_unit
                   , release_qty
                   , release_location
                   , release_reason
                   , last_receive_date
                   , regist_date
                   , regist_user)
             values (b.vessel_no
                   , b.release_no
                   , b.material_code
                   , b.release_date
                   , b.release_type
                   , b.release_unit
                   , b.release_qty
                   , b.release_location
                   , b.release_reason
                   , now()::timestamp
                   , b.regist_date
                   , b.regist_user);`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'adjustmentNo', value: item.adjustment_no },
        { name: 'materialCode', value: item.material_code },
        { name: 'adjustmentDate', value: item.adjustment_date },
        { name: 'adjustmentType', value: item.adjustment_type },
        { name: 'adjustmentUnit', value: item.adjustment_unit },
        { name: 'adjustmentQty', value: item.adjustment_qty },
        { name: 'adjustmentLocation', value: item.adjustment_location },
        { name: 'adjustmentReason', value: item.adjustment_reason },
        { name: 'registDate', value: item.regist_date },
        { name: 'registUser', value: item.regist_user },
        { name: 'modifyDate', value: item.modify_date },
        { name: 'modifyUser', value: item.modify_user },
      ]
    );

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not saved.' }, { status: 401 });
    }

    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}