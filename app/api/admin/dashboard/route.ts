import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Vessel } from '@/types/dashboard/vessel';

export async function GET(req: Request) {
  try {
    // DB에서 데쉬보드 정보 확인
    const items: Vessel[] = await query(
      `select a.vessel_no
            , a.vessel_name
            , a.vessel_short_name
            , a.imo_no
            , sum(case when b.due_date < now()::timestamp then 1 else 0 end) as delayed_tasks
            , sum(case when b.due_date >= date_trunc('week', now())::timestamp and b.due_date <= (date_trunc('week', now()) + interval '7 day')::timestamp then 1 else 0 end) as weekly_tasks
            , sum(case when b.due_date >= date_trunc('month', now())::timestamp and b.due_date < (date_trunc('month', now()) + interval '1 month')::timestamp then 1 else 0 end) as monthly_tasks
            , sum(case when b.lastest_date >= date_trunc('month', now())::timestamp and b.lastest_date < (date_trunc('month', now()) + interval '1 month')::timestamp then 1 else 0 end) as completed_tasks
            , sum(case when b.due_date >= date_trunc('month', now())::timestamp and b.due_date < (date_trunc('month', now()) + interval '1 month')::timestamp then 1 else 0 end) +
              sum(case when b.lastest_date >= date_trunc('month', now())::timestamp and b.lastest_date < (date_trunc('month', now()) + interval '1 month')::timestamp then 1 else 0 end) as total_tasks
         from vessel as a
         left outer join (select vessel_no
                               , equip_no
                               , section_code
                               , plan_code
                               , plan_name
                               , lastest_date
                               , case when public.fn_get_maintenance_extension(vessel_no, equip_no, section_code, plan_code) >
                                           case interval_term when 'YEAR' then (lastest_date + make_interval(years => interval))
                                                              when 'MONTH' then (lastest_date + make_interval(months => interval))
                                                              when 'DAY' then (lastest_date + make_interval(days => interval))
                                                              when 'HOURS' then (lastest_date + make_interval(days => (interval / 24))) end
                                      then public.fn_get_maintenance_extension(vessel_no, equip_no, section_code, plan_code)
                                      else case interval_term when 'YEAR' then (lastest_date + make_interval(years => interval))
                                                              when 'MONTH' then (lastest_date + make_interval(months => interval))
                                                              when 'DAY' then (lastest_date + make_interval(days => interval))
                                                              when 'HOURS' then (lastest_date + make_interval(days => (interval / 24))) end
                                      end as due_date
                            from maintenance_plan) as b
           on a.vessel_no = b.vessel_no
        where a.use_yn = 'Y'
        group by a.vessel_no
               , a.vessel_name
               , a.imo_no
               , a.vessel_short_name`
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