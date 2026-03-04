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
      `select a.vessel_no
            , a.vessel_name
            , b.equip_no
            , b.equip_name
            , b.category
            , b.machine_name
            , c.section_code
            , c.section_name
            , d.plan_code
            , d.plan_name
            , d.manufacturer
            , d.model
            , d.specifications
            , convert(varchar(10), d.lastest_date, 121) as lastest_date
            , d.workers
            , d.work_hours
            , d.interval
            , d.interval_term
            , d.location
            , d.self_maintenance
            , d.manager
            , d.critical
            , convert(varchar(10), d.due_date, 121) as due_date 
            , convert(varchar(10), d.next_due_date, 121) as next_due_date 
            , convert(varchar(10), d.extension_date, 121) as extension_date 
            , case 
              -- 연장
              when d.due_date < getdate() 
                  and d.lastest_date < getdate() 
                  and d.extension_date >= getdate()
                then 'EXTENSION'

              -- 지연
              when d.due_date < getdate()
                then 'DELAYED'

              -- 완료 (이번 달 완료 기준 유지)
              when d.lastest_date >= dateadd(month, datediff(month, 0, getdate()), 0) 
                  and d.lastest_date < dateadd(month, 1, dateadd(month, datediff(month, 0, getdate()), 0))
                then 'COMPLATE'

              -- 금주 예정
              when d.due_date >= dateadd(week, datediff(week, 0, getdate()), 0)
                  and d.due_date < dateadd(week, datediff(week, 0, getdate()) + 1, 0)
                then 'WEEKLY'

              -- 금월 예정 (금주 제외)
              when d.due_date >= dateadd(month, datediff(month, 0, getdate()), 0)
                  and d.due_date < dateadd(month, 1, dateadd(month, datediff(month, 0, getdate()), 0))
                then 'MONTHLY'

              -- 그 외
              else 'NORMAL'

            end as status
            , datediff(day, getdate(), d.due_date) as days_until
            , datediff(day, getdate(), d.extension_date) as extension_days_until
         from [vessel] as a
         left outer join [equipment] as b
           on a.vessel_no = b.vessel_no
		 left outer join [section] as c
           on b.vessel_no = c.vessel_no
          and b.equip_no = c.equip_no
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
                               , case interval_term when 'YEAR' then dateadd(year, interval, lastest_date)
                                                    when 'MONTH' then dateadd(month, interval, lastest_date)
                                                    when 'DAY' then dateadd(day, interval, lastest_date)
                                                    when 'HOURS' then dateadd(day, interval / 24, lastest_date) end as due_date
                               , case interval_term when 'YEAR' then dateadd(year, interval, getdate())
                                                    when 'MONTH' then dateadd(month, interval, getdate())
                                                    when 'DAY' then dateadd(day, interval, getdate())
                                                    when 'HOURS' then dateadd(day, interval / 24, getdate()) end as next_due_date
                               , dbo.fn_get_maintenance_extension(vessel_no, equip_no, section_code, plan_code) as extension_date
                            from [maintenance_plan]
                           where vessel_no = @vesselNo) as d
           on c.vessel_no = d.vessel_no
          and c.equip_no = d.equip_no
          and c.section_code = d.section_code
        where a.use_yn = 'Y'
          and a.vessel_no = @vesselNo
          and ((d.due_date < getdate() and (d.extension_date is null or (d.extension_date >= dateadd(month, datediff(month, 0, getdate()), 0) and d.extension_date < dateadd(month, 1, dateadd(month, datediff(month, 0, getdate()), 0))))) 
               or 
               (d.due_date >= getdate() and d.due_date < dateadd(month, 1, getdate()))
               or
               (d.lastest_date >= dateadd(month, datediff(month, 0, getdate()), 0) and d.lastest_date < dateadd(month, 1, dateadd(month, datediff(month, 0, getdate()), 0))))
        order by d.equip_no, d.section_code, d.due_date, d.lastest_date`,
      [
        { name: 'vesselNo', value: vessel_no },
      ]
    );

    let equipmentTasks: Maintenance[] = [];
    let section: Maintenance;
    let equipment : Maintenance;
    let equipNo: string = '';
    let sectionCode: string = '';

    items.map(item => {
      if (equipNo !== item.equip_no) {
        equipment = {
          vessel_no: item.vessel_no,
          vessel_name: item.vessel_name,
          equip_no: item.equip_no,
          equip_name: item.equip_name,
          category: item.category,
          machine_name: item.machine_name,
          type: "EQUIPMENT",
          children: [] = []
        }

        equipmentTasks.push(equipment);
        equipNo = item.equip_no;
        sectionCode = '';
      }

      if (sectionCode !== item.section_code) {
        section = {
          vessel_no: item.vessel_no,
          vessel_name: item.vessel_name,
          equip_no: item.equip_no,
          equip_name: item.equip_name,
          category: item.category,
          machine_name: item.machine_name,
          section_code: item.section_code || '',
          section_name: item.section_name || '',
          type: "SECTION",
          children: [] = []
        }

        equipment.children.push(section);
        sectionCode = item.section_code || ''
      }

      item.type = "TASK";
      section.children.push(item);
    });
    // 성공 시 정비 계획 정보 반환
    return NextResponse.json(equipmentTasks);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}