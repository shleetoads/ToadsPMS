import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Equipment } from '@/types/dashboard/equipment';
import { Maintenance } from '@/types/dashboard/maintenance';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const vessel_no = url.searchParams.get('vesselNo');

    // DB에서 데쉬보드 정보 확인
    const items: Maintenance[] = await query(
      // `select a.vessel_no
      //       , a.vessel_name
      //       , b.equip_no
      //       , c.equip_name
      //       , c.category
      //       , b.section_code
      //       , b.plan_code
      //       , b.plan_name
      //       , b.manufacturer
      //       , b.model
      //       , b.specifications
      //       , convert(varchar(10), b.lastest_date, 121) as lastest_date
      //       , b.workers
      //       , b.work_hours
      //       , b.interval
      //       , b.interval_term
      //       , b.location
      //       , b.self_maintenance
      //       , b.manager
      //       , b.critical
      //       , convert(varchar(10), b.due_date, 121) as due_date 
      //       , convert(varchar(10), b.next_due_date, 121) as next_due_date 
      //       , convert(varchar(10), b.extension_date, 121) as extension_date 
      //       , case when b.due_date < getdate() and b.lastest_date < getdate() and b.extension_date >= getdate() then 'EXTENSION'
			//              when b.due_date < getdate() then 'DELAYED' 
      //              when b.lastest_date >= dateadd(month, datediff(month, 0, getdate()), 0) and b.lastest_date < dateadd(month, 1, dateadd(month, datediff(month, 0, getdate()), 0)) then 'COMPLATE'
      //              else 'NORMAL' end as status
      //       , datediff(day, getdate(), b.due_date) as days_until
      //       , datediff(day, getdate(), b.extension_date) as extension_days_until
      //    from [vessel] as a
      //    left outer join (select vessel_no
      //                          , equip_no
      //                          , section_code
      //                          , plan_code
      //                          , plan_name
      //                          , manufacturer
      //                          , model
      //                          , specifications
      //                          , lastest_date
      //                          , workers
      //                          , work_hours
      //                          , interval
      //                          , interval_term
      //                          , location
      //                          , self_maintenance
      //                          , manager
      //                          , critical
      //                          , case interval_term when 'YEAR' then dateadd(year, interval, lastest_date)
      //                                               when 'MONTH' then dateadd(month, interval, lastest_date)
      //                                               when 'DAY' then dateadd(day, interval, lastest_date)
      //                                               when 'HOURS' then dateadd(day, interval / 24, lastest_date) end as due_date
      //                          , case interval_term when 'YEAR' then dateadd(year, interval, getdate())
      //                                               when 'MONTH' then dateadd(month, interval, getdate())
      //                                               when 'DAY' then dateadd(day, interval, getdate())
      //                                               when 'HOURS' then dateadd(day, interval / 24, getdate()) end as next_due_date
      //                          , dbo.fn_get_maintenance_extension(vessel_no, equip_no, section_code, plan_code) as extension_date
      //                       from [maintenance_plan]
      //                      where vessel_no = @vesselNo) as b
      //      on a.vessel_no = b.vessel_no
      //    left outer join [equipment] as c
      //      on b.vessel_no = c.vessel_no
      //     and b.equip_no = c.equip_no
      //   where a.use_yn = 'Y'
      //     and a.vessel_no = @vesselNo
      //     and ((b.due_date < getdate() and (b.extension_date is null or (b.extension_date >= dateadd(month, datediff(month, 0, getdate()), 0) and b.extension_date < dateadd(month, 1, dateadd(month, datediff(month, 0, getdate()), 0))))) 
      //          or 
      //          (b.due_date >= getdate() and b.due_date < dateadd(month, 1, getdate()))
      //          or
      //          (b.lastest_date >= dateadd(month, datediff(month, 0, getdate()), 0) and b.lastest_date < dateadd(month, 1, dateadd(month, datediff(month, 0, getdate()), 0))))
      //   order by b.equip_no, b.due_date, b.lastest_date`,
      `WITH LatestExtension AS (
    SELECT
          me.vessel_no
        , me.equip_no
        , me.section_code
        , me.plan_code
        , me.extension_seq
        , me.extension_date
        , me.approval_status
        , ROW_NUMBER() OVER (
              PARTITION BY me.vessel_no, me.equip_no, me.section_code, me.plan_code
              ORDER BY me.extension_seq DESC
          ) AS rn
    FROM maintenance_extension me
),
PlanBase AS (
    SELECT
          mp.vessel_no
        , v.vessel_name
        , mp.equip_no
        , e.equip_name
        , e.machine_name
        , e.category
        , mp.section_code
        , s.section_name
        , mp.plan_code
        , mp.plan_name
        , mp.manufacturer
        , mp.model
        , mp.specifications
        , mp.lastest_date
        , mp.lastest_run_hour
        , mp.workers
        , mp.work_hours
        , mp.interval
        , mp.interval_term
        , mp.location
        , mp.self_maintenance
        , mp.manager
        , mp.critical
        , er.lastest_upload_date
        , er.lastest_runtime

        , CASE
              WHEN er.lastest_upload_date IS NULL
                OR er.prev_upload_date IS NULL
                OR er.lastest_runtime IS NULL
                OR er.prev_runtime IS NULL
              THEN CAST(1440 AS decimal(18,2))

              WHEN (er.lastest_runtime - er.prev_runtime) <= 0
              THEN CAST(1440 AS decimal(18,2))

              ELSE CAST(
                  1.0 * (er.lastest_runtime - er.prev_runtime)
                  / CASE
                        WHEN DATEDIFF(day, er.prev_upload_date, er.lastest_upload_date) = 0
                        THEN 1
                        ELSE DATEDIFF(day, er.prev_upload_date, er.lastest_upload_date)
                    END
                  AS decimal(18,2)
              )
          END AS diff_per_day

        , le.extension_date
        , le.approval_status
    FROM maintenance_plan mp
    LEFT JOIN vessel v
           ON mp.vessel_no = v.vessel_no
    LEFT JOIN equipment e
           ON mp.vessel_no = e.vessel_no
          AND mp.equip_no  = e.equip_no
    LEFT JOIN section s
           ON mp.vessel_no    = s.vessel_no
          AND mp.equip_no     = s.equip_no
          AND mp.section_code = s.section_code
    LEFT JOIN equipment_runtime er
           ON mp.vessel_no    = er.vessel_no
          AND mp.equip_no     = er.equip_no
          AND e.machine_name  = er.machine_name
    LEFT JOIN LatestExtension le
           ON mp.vessel_no    = le.vessel_no
          AND mp.equip_no     = le.equip_no
          AND mp.section_code = le.section_code
          AND mp.plan_code    = le.plan_code
          AND le.rn = 1
    WHERE mp.vessel_no = @vesselNo
),
PlanCalc AS (
    SELECT
          pb.*

        , CASE
              WHEN pb.interval_term = 'HOURS'
              THEN ISNULL(pb.lastest_run_hour, 0) + (ISNULL(pb.interval, 0) * 60)
              ELSE NULL
          END AS due_runtime

        , CASE
              WHEN pb.interval_term = 'HOURS'
                   AND pb.diff_per_day > 0
              THEN CAST((ISNULL(pb.interval, 0) * 60) AS decimal(18,2)) / pb.diff_per_day
              ELSE NULL
          END AS remain_days

        , CASE
              WHEN pb.interval_term = 'YEAR'
              THEN DATEADD(year, pb.interval, pb.lastest_date)

              WHEN pb.interval_term = 'MONTH'
              THEN DATEADD(month, pb.interval, pb.lastest_date)

              WHEN pb.interval_term = 'DAY'
              THEN DATEADD(day, pb.interval, pb.lastest_date)

              WHEN pb.interval_term = 'HOURS'
                   AND pb.diff_per_day > 0
              THEN DATEADD(
                       day,
                       CAST((ISNULL(pb.interval, 0) * 60) AS decimal(18,2)) / pb.diff_per_day,
                       pb.lastest_date
                   )

              ELSE pb.lastest_date
          END AS due_date

        , CASE
              WHEN pb.interval_term = 'YEAR'
              THEN DATEADD(year, pb.interval, GETDATE())

              WHEN pb.interval_term = 'MONTH'
              THEN DATEADD(month, pb.interval, GETDATE())

              WHEN pb.interval_term = 'DAY'
              THEN DATEADD(day, pb.interval, GETDATE())

              WHEN pb.interval_term = 'HOURS'
                   AND pb.diff_per_day > 0
              THEN DATEADD(
                       day,
                       CAST((ISNULL(pb.interval, 0) * 60) AS decimal(18,2)) / pb.diff_per_day,
                       GETDATE()
                   )

              ELSE GETDATE()
          END AS next_due_date
    FROM PlanBase pb
),
PlanStatusBase AS (
    SELECT
          pc.*
        , CAST(GETDATE() AS date) AS today_date
        , CAST(pc.due_date AS date) AS due_date_only
        , CAST(pc.next_due_date AS date) AS next_due_date_only
        , CAST(pc.extension_date AS date) AS extension_date_only
        , CAST(pc.lastest_date AS date) AS lastest_date_only
    FROM PlanCalc pc
)
SELECT
      vessel_no
    , vessel_name
    , equip_no
    , equip_name
    , machine_name
    , category
    , section_code
    , section_name
    , plan_code
    , plan_name
    , manufacturer
    , model
    , specifications
    , CONVERT(varchar(10), lastest_date, 23) AS lastest_date
    , lastest_run_hour
    , workers
    , work_hours
    , interval
    , interval_term
    , location
    , self_maintenance
    , manager
    , critical
    , CONVERT(varchar(10), lastest_upload_date, 23) AS lastest_upload_date
    , lastest_runtime
    , CAST(diff_per_day AS decimal(18,2)) AS diff_per_day
    , CONVERT(varchar(10), extension_date, 23) AS extension_date
    , approval_status
    , due_runtime
    , CAST(remain_days AS decimal(18,2)) AS remain_days
    , CONVERT(varchar(10), due_date, 23) AS due_date
    , CONVERT(varchar(10), next_due_date, 23) AS next_due_date

    , CASE
          WHEN extension_date_only IS NOT NULL
           AND due_date_only IS NOT NULL
           AND extension_date_only > due_date_only
          THEN 'EXTENSION'

          WHEN due_date_only IS NOT NULL
           AND today_date > due_date_only
          THEN 'DELAYED'

          WHEN lastest_date_only IS NOT NULL
           AND lastest_date_only >= DATEADD(month, -1, today_date)
           AND lastest_date_only <= today_date
          THEN 'COMPLATE'

          WHEN due_date_only IS NOT NULL
           AND DATEDIFF(day, today_date, due_date_only) >= 0
           AND DATEDIFF(day, today_date, due_date_only) < 7
          THEN 'WEEKLY'

          WHEN due_date_only IS NOT NULL
           AND DATEDIFF(day, today_date, due_date_only) >= 0
           AND DATEDIFF(day, today_date, due_date_only) < 30
          THEN 'MONTHLY'

          ELSE 'NORMAL'
      END AS status

FROM PlanStatusBase
ORDER BY
      equip_no
    , section_code
    , plan_code;`,
      [
        { name: 'vesselNo', value: vessel_no },
      ]
    );

    let equipmentTasks: Equipment[] = [];
    let equipTask : Equipment;
    let equipNo: string = '';

    items.map(item => {
      if (equipNo !== item.equip_no) {
        equipTask = {
          vessel_no: item.vessel_no,
          equip_no: item.equip_no,
          equip_name: item.equip_name,
          category: item.category,
          children: [] = []
        }

        equipmentTasks.push(equipTask);
        equipNo = item.equip_no;
      }

      equipTask.children.push(item);
    });
    // 성공 시 정비 계획 정보 반환
    return NextResponse.json(equipmentTasks);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}