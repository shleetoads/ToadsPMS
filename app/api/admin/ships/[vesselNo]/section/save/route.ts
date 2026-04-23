import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { Section } from '@/types/vessel/section';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item: Section = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `merge section as a
       using (select @vesselNo as vessel_no
                   , @equipNo as equip_no
                   , @sectionCode as section_code
                   , @sectionName as section_name
                   , @description as description
                   , @registUser as regist_user
                   , @modifyUser as modify_user) as b
          on (a.vessel_no = b.vessel_no and a.equip_no = b.equip_no and a.section_code = b.section_code)
        when matched then
             update
                set section_name = b.section_name
                  , description = b.description
                  , modify_date = now()::timestamp
                  , modify_user = b.modify_user
        when not matched then
             insert (vessel_no
                   , equip_no
                   , section_code
                   , section_name
                   , description
                   , regist_date
                   , regist_user)
             values (b.vessel_no
                   , b.equip_no
                   , (select lpad((coalesce(max(section_code), 0) + 1)::text, 3, '0') from section where vessel_no = b.vessel_no and equip_no = b.equip_no)
                   , b.section_name
                   , b.description
                   , now()::timestamp
                   , b.regist_user);`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'equipNo', value: item.equip_no },
        { name: 'sectionCode', value: item.section_code },
        { name: 'sectionName', value: item.section_name },
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