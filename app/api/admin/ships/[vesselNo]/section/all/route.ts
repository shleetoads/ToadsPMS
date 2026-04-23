import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Section } from '@/types/vessel/section';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 정보 확인
    const items: Section[] = await query(
      `select a.vessel_no
            , a.equip_no
            , a.section_code
            , a.section_name
            , a.description
            , (select count(1) from maintenance_plan where vessel_no = a.vessel_no and equip_no = a.equip_no and section_code = a.section_code) as maintenance_count
         from section as a
        where a.vessel_no = @vesselNo`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    // if (items.length === 0) {
    //   return NextResponse.json({ success: false, message: 'The data does not exist.' }, { status: 401 });
    // }

    // 성공 시 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}