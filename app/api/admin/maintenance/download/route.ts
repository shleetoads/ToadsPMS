import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { PMSData } from '@/types/status/pms_data'; // ✅ interface import

export async function GET(req: Request) {
  try {
    // DB에서 데쉬보드 정보 확인
    const items: PMSData[] = await query(
      `select a.vessel_no as coll_sign
            , a.vessel_name
            , a.machine_name
            , a.equip_name
            , a.section_name
            , a.plan_name
            , a.interval
            , a.interval_term
            , a.lastest_date
            , to_char(a.due_date, 'YYYY-MM-DD') as due_date 
         from (select a.vessel_no
                    , a.vessel_name
                    , b.machine_name
                    , coalesce(m.sort_no, 999) as machine_sort
                    , b.equip_no
                    , b.equip_name
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
                 from vessel as a
                inner join equipment as b
                   on a.vessel_no = b.vessel_no
                 left outer join machine as m
                   on b.vessel_no = m.vessel_no
                  and b.machine_name = m.machine_name
                 left outer join section as c
                   on b.vessel_no = c.vessel_no
                  and b.equip_no = c.equip_no
                 left outer join maintenance_plan as d
                   on c.vessel_no = d.vessel_no
                  and c.equip_no = d.equip_no
                  and c.section_code = d.section_code
                where a.use_yn = 'Y') as a
       order by a.vessel_no, a.machine_sort, a.equip_no, a.section_code, a.plan_code`);


    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}