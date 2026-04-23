import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { Section } from '@/types/vessel/section';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item: Section = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `update section
          set section_name = @sectionName
            , description = @description
            , modify_date = now()::timestamp
            , modify_user = @modifyUser
        where vessel_no = @vesselNo 
          and equip_no = @equipNo 
          and section_code = @sectionCode;`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'equipNo', value: item.equip_no },
        { name: 'sectionCode', value: item.section_code },
        { name: 'sectionName', value: item.section_name },
        { name: 'description', value: item.description },
        { name: 'modifyUser', value: item.modify_user },
      ]
    );


    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not updated.' }, { status: 401 });
    }

    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}