import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Equipment } from '@/types/calendar/equipment';
import { CalendarDate } from '@/types/calendar/calendar_date';
import { Maintenance } from '@/types/calendar/maintenance';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 정보 확인
    const items: Maintenance[] = await query(
      `select a.vessel_no
            , a.equip_no
            , a.equip_name
            , a.section_code
            , a.section_name
            , a.plan_code
            , a.plan_name
            , a.workers
            , a.work_hours
            , a.location
            , a.self_maintenance
            , a.manager
            , a.critical
            , to_char(a.lastest_date, 'YYYY-MM-DD') as lastest_date
            , to_char(a.due_date, 'YYYY-MM-DD') as due_date
            , to_char(a.extension_date, 'YYYY-MM-DD') as extension_date
            , to_char(case when a.due_date < now()::timestamp and a.extension_date is null then (now()::timestamp + make_interval(days => -1))
                                        when a.due_date < now()::timestamp and a.extension_date is not null and a.extension_date > now()::timestamp then a.extension_date
                                        else a.due_date end, 'YYYY-MM-DD') as calendar_date
            , case when a.due_date < now()::timestamp and a.lastest_date < now()::timestamp and a.extension_date >= now()::timestamp then 'EXTENSION'
			             when a.due_date < now()::timestamp then 'DELAYED' 
                   else 'NORMAL' end as status
         from (select a.vessel_no
                    , c.equip_no
                    , c.equip_name
                    , b.section_code
                    , b.section_name
                    , a.plan_code
                    , a.plan_name
                    , a.workers
                    , a.work_hours
                    , a.location
                    , a.self_maintenance
                    , a.manager
                    , a.critical
                    , a.lastest_date
                    , case a.interval_term when 'YEAR' then (a.lastest_date + make_interval(years => a.interval))
                                           when 'MONTH' then (a.lastest_date + make_interval(months => a.interval))
                                           when 'DAY' then (a.lastest_date + make_interval(days => a.interval))
                                           when 'HOURS' then (a.lastest_date + make_interval(days => (a.interval / 24))) end as due_date
                    , public.fn_get_maintenance_extension(a.vessel_no, a.equip_no, a.section_code, a.plan_code) as extension_date
                 from maintenance_plan as a
                inner join section as b
                   on a.vessel_no = b.vessel_no
                  and a.equip_no = b.equip_no
                  and a.section_code = b.section_code
                inner join equipment as c
                   on b.vessel_no = c.vessel_no
                  and b.equip_no = c.equip_no
                where a.vessel_no = @vesselNo) as a
        where (a.due_date < now()::timestamp or (a.due_date >= now()::timestamp and a.due_date <= (now()::timestamp + make_interval(days => 90))))
          and (a.extension_date is null or (a.extension_date >= now()::timestamp and a.extension_date <= (now()::timestamp + make_interval(days => 90))))
        order by a.vessel_no, a.equip_no, to_char(case when a.due_date < now()::timestamp then (now()::timestamp + make_interval(days => -1)) else a.due_date end, 'YYYY-MM-DD'), a.section_code, a.plan_code`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    let equipments: Equipment[] = [];
    let equipment : Equipment;
    let calendar : CalendarDate;
    let equipNo: string = '';
    let calendarDate: string = '';

    items.map(item => {
      if (equipNo !== item.equip_no) {
        equipment = {
          vessel_no: item.vessel_no,
          equip_no: item.equip_no,
          equip_name: item.equip_name,
          category: item.category,
          children: [] = []
        }

        equipments.push(equipment);
        equipNo = item.equip_no;
        calendarDate = '';
      }

      if (calendarDate !== item.calendar_date) {
        calendar = {
          calendar_date: item.calendar_date,
          children: [] = []
        }

        equipment.children.push(calendar);
        calendarDate = item.calendar_date;
      }

      calendar.children.push(item);
    });

    // 성공 시 정보 반환
    return NextResponse.json(equipments);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}