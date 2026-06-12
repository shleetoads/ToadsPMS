import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Maintenance } from '@/types/dashboard/maintenance';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const vessel_no = url.searchParams.get('vesselNo');

    // DB에서 데쉬보드 정보 확인
    const items: Maintenance[] = await query(
      `select a.vessel_no
            , a.vessel_name
            , b.equip_no
            , c.equip_name
            , b.section_code
            , b.plan_code
            , b.plan_name
            , b.manufacturer
            , b.model
            , b.specifications
            , to_char(b.lastest_date, 'YYYY-MM-DD') as lastest_date
            , b.workers
            , b.work_hours
            , b.interval
            , b.interval_term
            , b.location
            , b.self_maintenance
            , b.manager
            , b.critical
            , to_char(b.due_date, 'YYYY-MM-DD') as due_date 
            , to_char(b.next_due_date, 'YYYY-MM-DD') as next_due_date 
            , to_char(b.extension_date, 'YYYY-MM-DD') as extension_date 
            , case when (b.extension_date)::date is not null and (b.due_date)::date is not null and (b.extension_date)::date > (b.due_date)::date then 'EXTENSION'
                   when (b.due_date)::date is not null and (now()::timestamp)::date > (b.due_date)::date then 'DELAYED'
                   when (b.lastest_date)::date is not null and (b.lastest_date)::date >= ((now()::timestamp)::date + make_interval(months => (-1)::int)) and (b.lastest_date)::date <= (now()::timestamp)::date then 'COMPLETE'
                   when (b.due_date)::date is not null and (b.due_date)::date >= (now()::timestamp)::date and (b.due_date)::date < (date_trunc('week', now())::date + 7) then 'WEEKLY'
                   when (b.due_date)::date is not null and (b.due_date)::date >= (now()::timestamp)::date and (b.due_date)::date < (date_trunc('month', now()) + interval '1 month')::date then 'MONTHLY'
                   else 'NORMAL' end as status
            , ((b.due_date)::date - (now()::timestamp)::date) as days_until
            , ((b.extension_date)::date - (now()::timestamp)::date) as extension_days_until
          from vessel as a
          left outer join (select vessel_no
                                , equip_no
                                , section_code
                                , plan_code
                                , plan_name
                                , manufacturer
                                , model
                                , specifications
                                , lastest_date
                                , workers
                                , work_hours
                                , interval
                                , interval_term
                                , location
                                , self_maintenance
                                , manager
                                , critical
                                , case interval_term when 'YEAR' then (lastest_date + make_interval(years => (interval)::int))
                                                    when 'MONTH' then (lastest_date + make_interval(months => (interval)::int))
                                                    when 'DAY' then (lastest_date + make_interval(days => (interval)::int))
                                                    when 'HOURS' then (lastest_date + make_interval(days => ((interval / 24))::int)) end as due_date
                                , case interval_term when 'YEAR' then (now()::timestamp + make_interval(years => (interval)::int))
                                                    when 'MONTH' then (now()::timestamp + make_interval(months => (interval)::int))
                                                    when 'DAY' then (now()::timestamp + make_interval(days => (interval)::int))
                                                    when 'HOURS' then (now()::timestamp + make_interval(days => ((interval / 24))::int)) end as next_due_date
                                , public.fn_get_maintenance_extension(vessel_no, equip_no, section_code, plan_code) as extension_date
                            from maintenance_plan
                            where vessel_no = @vesselNo) as b
            on a.vessel_no = b.vessel_no
          left outer join equipment as c
            on b.vessel_no = c.vessel_no
          and b.equip_no = c.equip_no
        where a.vessel_no = @vesselNo
          and a.use_yn = 'Y'
          and (b.due_date)::date >= (date_trunc('week', now())::date + 7)
          and (b.due_date)::date < (date_trunc('month', now()) + interval '1 month')::date`,
      [
        { name: 'vesselNo', value: vessel_no },
      ]
    );

    // 성공 시 정비 계획 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}