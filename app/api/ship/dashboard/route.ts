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
                        WHEN ((er.lastest_upload_date)::date - (er.prev_upload_date)::date) = 0
                        THEN 1
                        ELSE ((er.lastest_upload_date)::date - (er.prev_upload_date)::date)
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
              THEN coalesce(pb.lastest_run_hour, 0) + (coalesce(pb.interval, 0) * 60)
              ELSE NULL
          END AS due_runtime

        , CASE
              WHEN pb.interval_term = 'HOURS'
                   AND pb.diff_per_day > 0
              THEN CAST((coalesce(pb.interval, 0) * 60) AS decimal(18,2)) / pb.diff_per_day
              ELSE NULL
          END AS remain_days

        , CASE
              WHEN pb.interval_term = 'YEAR'
              THEN (pb.lastest_date + make_interval(years => pb.interval))

              WHEN pb.interval_term = 'MONTH'
              THEN (pb.lastest_date + make_interval(months => pb.interval))

              WHEN pb.interval_term = 'DAY'
              THEN (pb.lastest_date + make_interval(days => pb.interval))

              WHEN pb.interval_term = 'HOURS'
                   AND pb.diff_per_day > 0
              THEN (pb.lastest_date + make_interval(days => (CAST((coalesce(pb.interval, 0) * 60) AS decimal(18,2)) / pb.diff_per_day)))

              ELSE pb.lastest_date
          END AS due_date

        , CASE
              WHEN pb.interval_term = 'YEAR'
              THEN (now()::timestamp + make_interval(years => pb.interval))

              WHEN pb.interval_term = 'MONTH'
              THEN (now()::timestamp + make_interval(months => pb.interval))

              WHEN pb.interval_term = 'DAY'
              THEN (now()::timestamp + make_interval(days => pb.interval))

              WHEN pb.interval_term = 'HOURS'
                   AND pb.diff_per_day > 0
              THEN (now()::timestamp + make_interval(days => (CAST((coalesce(pb.interval, 0) * 60) AS decimal(18,2)) / pb.diff_per_day)))

              ELSE now()::timestamp
          END AS next_due_date
    FROM PlanBase pb
),
PlanStatusBase AS (
    SELECT
          pc.*
        , CAST(now()::timestamp AS date) AS today_date
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
    , to_char(lastest_date, 'YYYY-MM-DD') AS lastest_date
    , lastest_run_hour
    , workers
    , work_hours
    , interval
    , interval_term
    , location
    , self_maintenance
    , manager
    , critical
    , to_char(lastest_upload_date, 'YYYY-MM-DD') AS lastest_upload_date
    , lastest_runtime
    , CAST(diff_per_day AS decimal(18,2)) AS diff_per_day
    , to_char(extension_date, 'YYYY-MM-DD') AS extension_date
    , approval_status
    , due_runtime
    , CAST(remain_days AS decimal(18,2)) AS remain_days
    , to_char(due_date, 'YYYY-MM-DD') AS due_date
    , to_char(next_due_date, 'YYYY-MM-DD') AS next_due_date

    , CASE
          WHEN extension_date_only IS NOT NULL
           AND due_date_only IS NOT NULL
           AND extension_date_only > due_date_only
          THEN 'EXTENSION'

          WHEN due_date_only IS NOT NULL
           AND today_date > due_date_only
          THEN 'DELAYED'

          WHEN lastest_date_only IS NOT NULL
           AND lastest_date_only >= (today_date + make_interval(months => -1))
           AND lastest_date_only <= today_date
          THEN 'COMPLETE'

          WHEN due_date_only IS NOT NULL
           AND ((due_date_only)::date - (today_date)::date) >= 0
           AND ((due_date_only)::date - (today_date)::date) < 7
          THEN 'WEEKLY'

          WHEN due_date_only IS NOT NULL
           AND ((due_date_only)::date - (today_date)::date) >= 0
           AND ((due_date_only)::date - (today_date)::date) < 30
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