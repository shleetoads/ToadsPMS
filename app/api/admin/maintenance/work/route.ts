import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { MaintenanceWork } from '@/types/vessel/maintenance_work'; // ✅ interface import

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const vesselNo = searchParams.get('vesselNo');
  const equipNo = searchParams.get('equipNo');
  const sectionCode = searchParams.get('sectionCode');
  const planCode = searchParams.get('planCode');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: MaintenanceWork[] = await query(
      `select work_order
            , to_char(work_date, 'YYYY-MM-DD') work_date
            , vessel_no
            , equip_no
            , section_code
            , plan_code
            , manager
            , work_details
            , used_parts
            , work_hours
            , delay_reason
         from maintenance_work
        where vessel_no = @vesselNo
          and equip_no = @equipNo
          and section_code = @sectionCode
          and plan_code = @planCode
        order by work_date desc`,
      [
        { name: 'vesselNo', value: vesselNo },
        { name: 'equipNo', value: equipNo },
        { name: 'sectionCode', value: sectionCode },
        { name: 'planCode', value: planCode },
      ]
    );

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}