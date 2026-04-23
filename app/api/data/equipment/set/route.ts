import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { Equipment } from '@/types/vessel/equipment';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item: Equipment = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `merge equipment as a
       using (select @vesselNo as vessel_no
                   , @equipNo as equip_no
                   , @equipName as equip_name
                   , @category as category
                   , @manufacturer as manufacturer
                   , @model as model
                   , @description as description
                   , @registUser as regist_user
                   , @modifyUser as modify_user) as b
          on (a.vessel_no = b.vessel_no and a.equip_no = b.equip_no)
        when matched then
             update
                set equip_name = b.equip_name
                  , category = b.category
                  , manufacturer = b.manufacturer
                  , model = b.model
                  , description = b.description
                  , last_receive_date = now()::timestamp
                  , modify_date = now()::timestamp
                  , modify_user = b.modify_user
        when not matched then
             insert (vessel_no
                   , equip_no
                   , equip_name
                   , category
                   , manufacturer
                   , model
                   , description
                   , last_receive_date
                   , regist_date
                   , regist_user)
             values (b.vessel_no
                   , b.equip_no
                   , b.equip_name
                   , b.category
                   , b.manufacturer
                   , b.model
                   , b.description
                   , now()::timestamp
                   , now()::timestamp
                   , b.regist_user);`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'equipNo', value: item.equip_no },
        { name: 'equipName', value: item.equip_name },
        { name: 'category', value: item.category },
        { name: 'manufacturer', value: item.manufacturer },
        { name: 'model', value: item.model },
        { name: 'description', value: item.description },
        { name: 'registUser', value: item.regist_user },
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