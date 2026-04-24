import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Maintenance } from '@/types/performance/maintenance';

export async function GET(req: Request) {
  try {
  const { searchParams } = new URL(req.url);

  const vesselNo = searchParams.get('vesselNo');
  const equipNo = searchParams.get('equipNo');
  const sectionCode = searchParams.get('sectionCode');
  const planCode = searchParams.get('planCode');

    // DB에서 데쉬보드 정보 확인
    const items: Maintenance[] = await query(
      `select a.vessel_no
            , a.vessel_name
            , a.imo_no
            , b.machine_name
            , b.equip_no
            , b.equip_name
            , b.category
            , c.section_code
            , c.section_name
            , d.plan_code
            , d.plan_name
            , d.interval
            , d.interval_term
            , to_char(d.lastest_date, 'YYYY-MM-DD') as lastest_date
            , to_char( case d.interval_term when 'YEAR' then (d.lastest_date + make_interval(years => (d.interval)::int))
                                                        when 'MONTH' then (d.lastest_date + make_interval(months => (d.interval)::int))
                                                        when 'DAY' then (d.lastest_date + make_interval(days => (d.interval)::int))
                                                        when 'HOURS' then (d.lastest_date + make_interval(days => ((d.interval / 24))::int)) end, 'YYYY-MM-DD') as due_date
            , to_char(e.work_date, 'YYYY-MM-DD') as work_date
          from vessel as a
         inner join equipment as b
            on a.vessel_no = b.vessel_no
          left join machine as z
            on b.vessel_no = z.vessel_no
           and b.machine_name = z.machine_name
         inner join section as c
            on b.vessel_no = c.vessel_no
           and b.equip_no = c.equip_no
         inner join maintenance_plan as d
            on c.vessel_no = d.vessel_no
           and c.equip_no = d.equip_no
           and c.section_code = d.section_code
          left outer join (select a1.vessel_no
                                , a1.equip_no
                                , a1.section_code
                                , a1.plan_code
                                , a1.work_date
                            from (select vessel_no
                                       , equip_no
                                       , section_code
                                       , plan_code
                                       , work_date
                                       , ROW_NUMBER() OVER (
                                             PARTITION BY vessel_no, equip_no, section_code, plan_code
                                             ORDER BY work_date DESC
                                         ) AS rownum
                                   from maintenance_work
                                  where vessel_no = @vesselNo
                                    and equip_no = @equipNo
                                    and section_code = @sectionCode
                                    and plan_code = @planCode) as a1
                                  where a1.rownum <= 5) as e
            on d.vessel_no = e.vessel_no
           and d.equip_no = e.equip_no
           and d.section_code = e.section_code
           and d.plan_code = e.plan_code
         where a.use_yn = 'Y'
           and d.vessel_no = @vesselNo
           and d.equip_no = @equipNo
           and d.section_code = @sectionCode
           and d.plan_code = @planCode
         order by a.vessel_no, coalesce(z.sort_no, 999), b.equip_no, c.section_code, d.plan_code, e.work_date`,
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