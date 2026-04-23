import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Maintenance } from '@/types/status/maintenance'; // ✅ interface import

export async function GET(req: Request) {
  try {
    // DB에서 데쉬보드 정보 확인
    const items: Maintenance[] = await query(
      `select a.vessel_no
            , a.vessel_name
            , a.machine_name
            , a.equip_no
            , a.equip_name
            , a.section_code
            , a.section_name
            , a.plan_code
            , a.plan_name
            , a.manufacturer
            , a.model
            , a.specifications
            , a.lastest_date
            , a.workers
            , a.work_hours
            , a.interval
            , a.interval_term
            , a.location
            , a.self_maintenance
            , a.manager
            , a.important_items
            , a.instructions
            , a.critical
            , to_char(a.due_date, 'YYYY-MM-DD') as due_date 
            , to_char(a.extension_date, 'YYYY-MM-DD') as extension_date 
            , case when a.due_date < now()::timestamp and a.lastest_date < now()::timestamp and a.extension_date >= now()::timestamp then 'EXTENSION'
			             when a.due_date < now()::timestamp then 'DELAYED' 
                   when a.lastest_date >= date_trunc('month', now())::timestamp and a.lastest_date < (date_trunc('month', now()) + interval '1 month')::timestamp then 'COMPLATE'
                   else 'NORMAL' end as status
            , ((a.due_date)::date - (now()::timestamp)::date) as days_until
            , ((a.extension_date)::date - (now()::timestamp)::date) as extension_days_until
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
                    , d.manufacturer
                    , d.model
                    , d.specifications
                    , to_char(d.lastest_date, 'YYYY-MM-DD') as lastest_date
                    , d.workers
                    , d.work_hours
                    , d.interval
                    , d.interval_term
                    , d.location
                    , d.self_maintenance
                    , d.manager
                    , d.important_items
                    , d.instructions
                    , d.critical
                    , to_char( case d.interval_term when 'YEAR' then (d.lastest_date + make_interval(years => d.interval))
                                                                when 'MONTH' then (d.lastest_date + make_interval(months => d.interval))
                                                                when 'DAY' then (d.lastest_date + make_interval(days => d.interval))
                                                                when 'HOURS' then (d.lastest_date + make_interval(days => (d.interval / 24))) end, 'YYYY-MM-DD') as due_date
                    , public.fn_get_maintenance_extension(d.vessel_no, d.equip_no, d.section_code, d.plan_code) as extension_date
                 from vessel as a
                 left outer join equipment as b
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


    let vessels: Maintenance[] = [];
    let vessel: Maintenance;
    let machine: Maintenance;
    let equipment: Maintenance;
    let section: Maintenance;
    let maintenance: Maintenance;

    let vesselNo: string = '';
    let machineName: string = '';
    let equipNo: string = '';
    let sectionCode: string = '';

    items.map(item => {
      if (vesselNo !== item.vessel_no) {
        vessel = {
          id: item.vessel_no,
          name: item.vessel_name || '',
          vessel_no: item.vessel_no,
          vessel_name: item.vessel_name,
          type: "VESSEL",
          children: [] = []
        }

        vessels.push(vessel);
        vesselNo = item.vessel_no;
        machineName = '';
        equipNo = '';
        sectionCode = '';
      }

      if (item.machine_name !== null && item.machine_name !== '') {
        if (machineName !== item.machine_name) {
          machine = {
            id: item.machine_name || '',
            name: item.machine_name || '',
            vessel_no: item.vessel_no,
            machine_name: item.machine_name,
            type: "MACHINE",
            children: [] = []
          }

          vessel?.children.push(machine);
          machineName = item.machine_name || '';
          equipNo = '';
          sectionCode = '';
        }

        if (item.equip_no !== null) {
          if (equipNo !== item.equip_no) {
            equipment = {
              id: item.equip_no || '',
              name: item.equip_name || '',
              vessel_no: item.vessel_no,
              equip_no: item.equip_no,
              equip_name: item.equip_name,
              type: "EQUIPMENT",
              children: [] = []
            }

            machine?.children.push(equipment);
            equipNo = item.equip_no || '';
            sectionCode = '';
          }

          if (item.section_code !== null) {
            if (sectionCode !== item.section_code) {
              
              section = {
                id: `${item.equip_no}-${item.section_code}`,
                name: item.section_name || '',
                vessel_no: item.vessel_no,
                type: "SECTION",
                children: [] = []
              }

              equipment?.children.push(section);
              sectionCode = item.section_code || '';
            }

            if (item.plan_code !== null) {
              maintenance = item;
              maintenance.id = `${item.equip_no}-${item.section_code}-${item.plan_code}`;
              maintenance.name = item.plan_name || '';
              maintenance.type = "TASK";

              section?.children.push(maintenance);
            }
          }
        }
      } else {
        if (item.equip_no !== null) {
          if (equipNo !== item.equip_no) {
            equipment = {
              id: item.equip_no || '',
              name: item.equip_name || '',
              vessel_no: item.vessel_no,
              type: "EQUIPMENT",
              children: [] = []
            }

            vessel?.children.push(equipment);
            equipNo = item.equip_no || '';
            sectionCode = '';
          }

          if (item.section_code !== null) {
            if (sectionCode !== item.section_code) {
              
              section = {
                id: `${item.equip_no}-${item.section_code}`,
                name: item.section_name || '',
                vessel_no: item.vessel_no,
                type: "SECTION",
                children: [] = []
              }

              equipment?.children.push(section);
              sectionCode = item.section_code || '';
            }

            if (item.plan_code !== null) {
              maintenance = item;
              maintenance.id = `${item.equip_no}-${item.section_code}-${item.plan_code}`;
              maintenance.name = item.plan_name || '';
              maintenance.type = "TASK";

              section?.children.push(maintenance);
            }
          }
        }
      }
    });

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(vessels);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}