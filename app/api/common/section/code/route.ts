import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Section } from '@/types/common/section';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: Section[] = await query(
      `select a.vessel_no
            , a.equip_no
            , b.machine_name
            , a.section_code
            , a.section_name
         from section as a
        inner join equipment as b
           on a.vessel_no = b.vessel_no
          and a.equip_no = b.equip_no
        where a.vessel_no = @vesselNo`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}