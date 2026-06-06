import { NextResponse } from 'next/server';
import { withTransaction, adaptNamedParams, NamedParam } from '@/db';

export async function POST(req: Request) {
  const body = await req.json();
  const {vesselNo, registUser, modifyUser, excelData} = body;

  if (!Array.isArray(excelData) || excelData.length === 0) {
    return NextResponse.json({ success: false, message: 'There is no valid data.' }, { status: 400 });
  }

  try {
    const count = await withTransaction(async (client) => {
      let count = 0;
      let equipNo: string = '';
      let machineName: string = '';
      let equipName: string = '';
      let sectionCode: string = '';
      let sectionName: string = '';
      // 한 업로드 내에서 장비별 운전시간 upsert를 1회만 수행 (prev/lastest 뒤바뀜 방지)
      const runtimeUpserted = new Set<string>();

      for (const rows of excelData) {
        if (vesselNo !== rows.CallSign.trim() ||
            !rows.Machine ||
            !rows.Equipment ||
            !rows.Section ||
            !rows.MaintenanceName) {
          continue;
        }

        if (rows.Machine && machineName !== rows.Machine) {
          equipName = '';
          sectionCode = '';
          sectionName = '';

          let queryString =
            `merge into machine as a
             using (select @vesselNo as vessel_no
                         , @machine as machine_name
                         , @manufacturer as manufacturer
                         , @registUser::integer as regist_user
                         , @modifyUser::integer as modify_user) as b
                on (a.vessel_no = b.vessel_no
               and  a.machine_name = b.machine_name)
              when matched then
                   update
                      set manufacturer = b.manufacturer
                        , modify_date = now()::timestamp
                        , modify_user = b.modify_user
              when not matched then
                   insert (
                           vessel_no
                         , machine_name
                         , manufacturer
                         , sort_no
                         , regist_date
                         , regist_user
                   )
                   values (
                           b.vessel_no
                         , b.machine_name
                         , b.manufacturer
                         , (select coalesce(max(sort_no), 0) + 1 from machine where vessel_no = b.vessel_no)
                         , now()::timestamp
                         , b.regist_user
                   );`

          let params: NamedParam[] = [
            { name: 'vesselNo', value: vesselNo },
            { name: 'machine', value: rows.Machine ? rows.Machine : '' },
            { name: 'manufacturer', value: rows.Maker ? rows.Maker : '' },
            { name: 'registUser', value: registUser },
            { name: 'modifyUser', value: modifyUser }
          ];

          const { text, values } = adaptNamedParams(queryString, params);
          let result = await client.query(text, values);

          machineName = rows.Machine;
        }

        if (rows.Equipment && equipName !== rows.Equipment) {
          sectionCode = '';
          sectionName = '';

          let queryString =
            `merge into equipment as a
             using (select @vesselNo as vessel_no
                         , @equipName as equip_name
                         , @category as category
                         , @manufacturer as manufacturer
                         , @model as model
                         , @machine as machine_name
                         , @registUser::integer as regist_user
                         , @modifyUser::integer as modify_user) as b
                on (a.vessel_no = b.vessel_no
               and  a.equip_name = b.equip_name
               and a.machine_name = b.machine_name )
              when matched then
                   update
                      set category = lower(b.category)
                        , manufacturer = b.manufacturer
                        , model = b.model
                        , machine_name = b.machine_name
                        , modify_date = now()::timestamp
                        , modify_user = b.modify_user
              when not matched then
                   insert (
                           vessel_no
                         , equip_no
                         , equip_name
                         , category
                         , manufacturer
                         , model
                         , machine_name
                         , regist_date
                         , regist_user
                   )
                   values (
                           b.vessel_no
                         , (select lpad((coalesce(max(equip_no::int), 0) + 1)::text, 3, '0') from equipment where vessel_no = b.vessel_no)
                         , b.equip_name
                         , lower(b.category)
                         , b.manufacturer
                         , b.model
                         , b.machine_name
                         , now()::timestamp
                         , b.regist_user
                   );`

          let params: NamedParam[] = [
            { name: 'vesselNo', value: vesselNo },
            { name: 'equipName', value: rows.Equipment },
            { name: 'category', value: rows.Category ? rows.Category : '' },
            { name: 'manufacturer', value: rows.Maker ? rows.Maker : '' },
            { name: 'model', value: rows.Type ? rows.Type : '' },
            { name: 'machine', value: rows.Machine ? rows.Machine : '' },
            { name: 'registUser', value: registUser },
            { name: 'modifyUser', value: modifyUser }
          ];

          const { text, values } = adaptNamedParams(queryString, params);
          let result = await client.query(text, values);

          equipName = rows.Equipment;

          if ((result.rowCount ?? 0) > 0) {
            queryString =
              `select equip_no
                 from equipment
                where vessel_no = @vesselNo
                  and equip_name = @equipName
                  and machine_name = @machine;`

            const { text: text2, values: values2 } = adaptNamedParams(queryString, params);
            result = await client.query(text2, values2);

            if ((result.rows ?? []).length > 0)
              equipNo = result.rows[0].equip_no;
            else
              equipNo = ''
          }
        }

        if (rows.Section && sectionName !== rows.Section) {
          let queryString =
            `merge into section as a
             using (select @vesselNo as vessel_no
                         , @equipNo as equip_no
                         , @sectionName as section_name
                         , @registUser::integer as regist_user
                         , @modifyUser::integer as modify_user) as b
                on (a.vessel_no = b.vessel_no
               and  a.equip_no = b.equip_no
               and  a.section_name = b.section_name)
              when matched then
                   update
                      set modify_date = now()::timestamp
                        , modify_user = b.modify_user
              when not matched then
                   insert (
                           vessel_no
                         , equip_no
                         , section_code
                         , section_name
                         , regist_date
                         , regist_user
                   )
                   values (
                           b.vessel_no
                         , b.equip_no
                         , (select lpad((coalesce(max(section_code::int), 0) + 1)::text, 3, '0') from section where vessel_no = b.vessel_no and equip_no = b.equip_no)
                         , b.section_name
                         , now()::timestamp
                         , b.regist_user
                   );`

          let params: NamedParam[] = [
            { name: 'vesselNo', value: vesselNo },
            { name: 'equipNo', value: equipNo },
            { name: 'sectionName', value: rows.Section },
            { name: 'registUser', value: registUser },
            { name: 'modifyUser', value: modifyUser }
          ];

          const { text, values } = adaptNamedParams(queryString, params);
          let result = await client.query(text, values);

          sectionName = rows.Section;

          if ((result.rowCount ?? 0) > 0) {
            queryString =
              `select section_code
                 from section
                where vessel_no = @vesselNo
                  and equip_no = @equipNo
                  and section_name = @sectionName;`

            const { text: text2, values: values2 } = adaptNamedParams(queryString, params);
            result = await client.query(text2, values2);

            if ((result.rows ?? []).length > 0)
              sectionCode = result.rows[0].section_code;
            else
              sectionCode = ''
          }
        }

        if (rows.MaintenanceName) {
          let queryString =
              `merge into maintenance_plan as a
              using (select @vesselNo as vessel_no
                          , @equipNo as equip_no
                          , @sectionCode as section_code
                          , @planName as plan_name
                          , @manufacturer as manufacturer
                          , @model as model
                          , @specifications as specifications
                          , @workers::integer as workers
                          , @workHours::integer as work_hours
                          , @intervalTerm as interval_term
                          , @interval::integer as interval
                          , case @location when 'DOCK' then 'D'
                                            when 'IN PORT' then 'P'
                                            when 'SAILING' then 'S' else '' end as location
                          , @manager as manager
                          , @selfMaintenance as self_maintenance
                          , @critical as critical
                          , @lastestDate::date as lastest_date
                          , @lastestRunHour::integer as lastest_run_hour
                          , @instructions as instructions
                          , @prevPmsCode as prev_pms_code
                          , @registUser::integer as regist_user
                          , @modifyUser::integer as modify_user) as b
                  on (a.vessel_no = b.vessel_no
                and  a.equip_no = b.equip_no
                and  a.section_code = b.section_code
                and  a.plan_name = b.plan_name)
                when matched then
                    update
                        set manufacturer = b.manufacturer
                          , model = b.model
                          , specifications = b.specifications
                          , workers = b.workers
                          , work_hours = b.work_hours
                          , interval_term = b.interval_term
                          , interval = b.interval
                          , location = b.location
                          , manager = b.manager
                          , self_maintenance = b.self_maintenance
                          , critical = b.critical
                          , lastest_date = b.lastest_date
                          , lastest_run_hour = b.lastest_run_hour
                          , instructions = b.instructions
                          , prev_pms_code = b.prev_pms_code
                          , modify_date = now()::timestamp
                          , modify_user = b.modify_user
                when not matched then
                    insert (
                            vessel_no
                          , equip_no
                          , section_code
                          , plan_code
                          , plan_name
                          , manufacturer
                          , model
                          , specifications
                          , workers
                          , work_hours
                          , interval_term
                          , interval
                          , location
                          , manager
                          , self_maintenance
                          , critical
                          , lastest_date
                          , lastest_run_hour
                          , instructions
                          , prev_pms_code
                          , regist_date
                          , regist_user
                    )
                    values (
                            b.vessel_no
                          , b.equip_no
                          , b.section_code
                          , (select lpad((coalesce(max(plan_code::int), 0) + 1)::text, 3, '0') from maintenance_plan where vessel_no = b.vessel_no and equip_no = b.equip_no and section_code = b.section_code)
                          , b.plan_name
                          , b.manufacturer
                          , b.model
                          , b.specifications
                          , b.workers
                          , b.work_hours
                          , b.interval_term
                          , b.interval
                          , b.location
                          , b.manager
                          , b.self_maintenance
                          , b.critical
                          , b.lastest_date
                          , b.lastest_run_hour
                          , b.instructions
                          , b.prev_pms_code
                          , now()::timestamp
                          , b.regist_user
                    );`

          let lastestDate = rows.LastestDate == 'N/A' ? null : rows.LastestDate;
          if (typeof lastestDate === 'number') {
            lastestDate = ConvertExcelSerialToData(lastestDate);
          }

          // LastestOperationTime(hh:mm) -> 분(min) 단위 정수로 변환하여 저장
          const lastestRunHour = ConvertTimeToMinutes(rows.LastestOperationTime);

          let params: NamedParam[] = [
            { name: 'vesselNo', value: vesselNo },
            { name: 'equipNo', value: equipNo },
            { name: 'sectionCode', value: sectionCode },
            { name: 'planName', value: rows.MaintenanceName},
            { name: 'manufacturer', value: rows.Manufacturer ? rows.Manufacturer : '' },
            { name: 'model', value: rows.Model ? rows.Model : '' },
            { name: 'specifications', value: rows.Specifications ? rows.Specifications : '' },
            { name: 'workers', value: rows.Workers},
            { name: 'workHours', value: rows.WorkHours},
            { name: 'intervalTerm', value: rows.IntervalTerm},
            { name: 'interval', value: rows.Interval},
            { name: 'location', value: rows.Location? rows.Location : '' },
            { name: 'manager', value: rows.PIC? rows.PIC : '' },
            { name: 'selfMaintenance', value: rows.SelfMaintenance? rows.SelfMaintenance : '' },
            { name: 'critical', value: rows.Critical? rows.Critical : '' },
            { name: 'lastestDate', value: lastestDate },
            { name: 'lastestRunHour', value: lastestRunHour },
            { name: 'instructions', value: rows.Instructions? rows.Instructions : '' },
            { name: 'prevPmsCode', value: rows.PrevPMSCode? rows.PrevPMSCode : '' },
            { name: 'registUser', value: registUser },
            { name: 'modifyUser', value: modifyUser }
          ];

          const { text, values } = adaptNamedParams(queryString, params);
          let result = await client.query(text, values);

          count += result.rowCount ?? 0;

          // LastestOperationTime 값이 있는 장비 = 운전시간 기록 대상 → equipment_runtime에 적재.
          // (더 이상 interval_term='HOURS' 여부로 판단하지 않음. 값 존재 = 기록 필요)
          // 업로드 일시는 now()가 아니라 LastestDate를 사용한다.
          if (lastestRunHour !== null &&
              equipNo &&
              !runtimeUpserted.has(equipNo)) {
            const runtimeQuery =
              `CALL usp_upsert_equipment_runtime(
                     @vesselNo
                   , @machineName
                   , @equipNo
                   , @equipName
                   , @runtime::integer
                   , @uploadDate::timestamp)`;

            const runtimeParams: NamedParam[] = [
              { name: 'vesselNo', value: vesselNo },
              { name: 'machineName', value: rows.Machine },
              { name: 'equipNo', value: equipNo },
              { name: 'equipName', value: rows.Equipment },
              { name: 'runtime', value: lastestRunHour },
              { name: 'uploadDate', value: lastestDate },
            ];

            const { text: rtText, values: rtValues } = adaptNamedParams(runtimeQuery, runtimeParams);
            await client.query(rtText, rtValues);

            runtimeUpserted.add(equipNo);
          }
        }
      }

      return count;
    });

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
    }
    return NextResponse.json({ success: true, total: excelData.length, count: count });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

// LastestOperationTime(누적 운전시간)을 분(min) 단위 정수로 변환한다.
// 클라이언트에서 이미 분 단위로 변환해 전송하므로 숫자는 그대로 사용한다.
// - 숫자: 분 단위 그대로 (예: 18010)
// - 문자열 "시:분" (시간 자릿수 무제한, 안전망): "300:10" -> 18010
// - 빈 값/형식 불일치 시 null 반환 (운전시간 기록이 불필요한 장비)
function ConvertTimeToMinutes(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  const match = String(value).trim().match(/^(\d+):(\d{1,2})$/);
  if (match) {
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  const numeric = Number(String(value).trim());
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function ConvertExcelSerialToData(serial: number): String {
  let daysToSubtract = 1;
  if (serial > 60) {
    daysToSubtract = 2;
  }

  const excelEpoch = new Date(Date.UTC(1900, 0, 1));
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const dateInMilliseconds = excelEpoch.getTime() + (serial - daysToSubtract) * millisecondsPerDay;
  const convertedDate = new Date(dateInMilliseconds);

  const year = convertedDate.getUTCFullYear();
  const month = convertedDate.getUTCMonth() + 1;
  const day = convertedDate.getUTCDate();

  const formattedMonth = String(month).padStart(2, '0');
  const formattedDay = String(day).padStart(2, '0');

  return `${year}-${formattedMonth}-${formattedDay}`;
}
