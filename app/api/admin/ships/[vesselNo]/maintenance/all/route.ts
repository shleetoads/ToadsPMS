import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { MaintenancePlan } from '@/types/vessel/maintenance_plan';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: MaintenancePlan[] = await query(
      `select vessel_no
            , equip_no
            , section_code
            , plan_code
            , plan_name
            , manufacturer
            , model
            , specifications
            , to_char(lastest_date, 'YYYY-MM-DD') as lastest_date
            , workers
            , work_hours
            , interval
            , interval_term
            , location
            , self_maintenance
            , manager
            , important_items
            , instructions
            , critical
            , to_char( case interval_term when 'YEAR' then (lastest_date + make_interval(years => interval))
                                                      when 'MONTH' then (lastest_date + make_interval(months => interval))
                                                      when 'DAY' then (lastest_date + make_interval(days => interval))
                                                      when 'HOURS' then (lastest_date + make_interval(days => (interval / 24))) end, 'YYYY-MM-DD') as due_date
         from maintenance_plan
        where vessel_no = @vesselNo`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    // if (items.length === 0) {
    //   return NextResponse.json({ success: false, message: 'The data does not exist.' }, { status: 401 });
    // }

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}