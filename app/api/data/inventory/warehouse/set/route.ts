import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { Warehouse } from '@/types/inventory/warehouse/warehouse';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item : Warehouse = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `merge warehouse as a
       using (select @vesselNo as vessel_no
                   , @warehouseNo as warehouse_no
                   , @warehouseName as warehouse_name
                   , @warehouseLocation as warehouse_location
                   , @useYn as use_yn
                   , @registDate as regist_date
                   , @registUser as regist_user
                   , @modifyDate as modify_date
                   , @modifyUser as modify_user) as b
          on (a.vessel_no = b.vessel_no 
          and a.warehouse_no = b.warehouse_no)
        when matched then
             update
                set warehouse_name = b.warehouse_name
                  , warehouse_location = b.warehouse_location
                  , use_yn = b.use_yn
                  , last_receive_date = now()::timestamp
                  , modify_date = b.modify_date
                  , modify_user = b.modify_user
        when not matched then
             insert (vessel_no
                   , warehouse_no
                   , warehouse_name
                   , warehouse_location
                   , use_yn
                   , last_receive_date
                   , regist_date
                   , regist_user)
             values (b.vessel_no
                   , b.warehouse_no
                   , b.warehouse_name
                   , b.warehouse_location
                   , b.use_yn
                   , now()::timestamp
                   , b.regist_date
                   , b.regist_user);`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'warehouseNo', value: item.warehouse_no },
        { name: 'warehouseName', value: item.warehouse_name },
        { name: 'warehouseLocation', value: item.warehouse_location },
        { name: 'useYn', value: item.use_yn },
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