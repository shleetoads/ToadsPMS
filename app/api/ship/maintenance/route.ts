import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Equipment } from '@/types/vessel/equipment';
import { Section } from '@/types/vessel/section';
import { MaintenancePlan } from '@/types/vessel/maintenance_plan';
import { Maintenance } from '@/types/vessel/maintenance';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: Maintenance[] = await query(
      `select a.vessel_no
            , a.machine_name
            , a.equip_no
            , a.equip_name
            , a.manufacturer as equip_manufacturer
            , a.model as equip_model
            , a.specifications as equip_specifications
            , b.section_code
            , b.section_name
            , b.description
            , c.plan_code
            , c.plan_name
            , c.manufacturer
            , c.model
            , c.specifications
            , to_char(c.lastest_date, 'YYYY-MM-DD') as lastest_date
            , c.workers
            , c.work_hours
            , c.interval
            , c.interval_term
            , c.location
            , c.self_maintenance
            , c.manager
            , c.important_items
            , c.instructions
            , c.critical
            , to_char( case c.interval_term when 'YEAR' then (c.lastest_date + make_interval(years => c.interval))
                                                        when 'MONTH' then (c.lastest_date + make_interval(months => c.interval))
                                                        when 'DAY' then (c.lastest_date + make_interval(days => c.interval))
                                                        when 'HOURS' then (c.lastest_date + make_interval(days => (c.interval / 24))) end, 'YYYY-MM-DD') as due_date
         from equipment as a
         left outer join machine as z
           on a.vessel_no = z.vessel_no
          and a.machine_name = z.machine_name
         left outer join section as b
           on a.vessel_no = b.vessel_no
          and a.equip_no = b.equip_no
         left outer join maintenance_plan as c
           on b.vessel_no = c.vessel_no
          and b.equip_no = c.equip_no
          and b.section_code = c.section_code
        where a.vessel_no = @vesselNo
        order by a.vessel_no, coalesce(z.sort_no, 999), a.equip_no, b.section_code, c.plan_code`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );
    
    let vessel: Maintenance = {
      id: '',
      name: '',
      vessel_no: '',
      children: [] = []
    };
    let machine: Maintenance;
    let equip: Maintenance;
    let section : Maintenance;
    let maintenance : Maintenance;
    
    let currVesselNo: string = '';
    let machineName: string = '';
    let equipNo: string = '';
    let sectionCode: string = '';

    items.map(item => {
      if (currVesselNo !== item.vessel_no) {
        vessel.id = item.machine_name || '',
        vessel.name = item.machine_name || '',
        vessel.vessel_no = item.vessel_no

        currVesselNo = item.vessel_no;
      }

      if (item.machine_name !== null && item.machine_name !== '') {
        if (machineName !== item.machine_name) {
          machine = { 
            id: item.machine_name || '',
            name: item.machine_name || '',
            vessel_no: item.vessel_no,
            machine_name: item.machine_name || '',
            type: 'MACHINE',
            key: item.machine_name || '',
            children: [] = []
          }
          
          vessel.children.push(machine);
          machineName = item.machine_name || '';
          equipNo = '';
          sectionCode = '';
        }

        if (equipNo !== item.equip_no) {
          equip = {
            id: item.equip_no || '',
            name: item.equip_name || '',
            vessel_no: item.vessel_no,
            machine_name: item.machine_name || '',
            equip_no: item.equip_no,
            equip_name: item.equip_name,
            manufacturer: item.equip_manufacturer,
            model: item.equip_model,
            specifications: item.equip_specifications,
            type: 'EQUIPMENT',
            key: item.equip_no,
            children: [] = []
          }
          
          machine.children.push(equip);
          equipNo = item.equip_no || '';
          sectionCode = '';
        }

        if (sectionCode !== item.section_code) {
          section = {
            id: item.section_code || '',
            name: item.section_name || '',
            vessel_no: item.vessel_no,
            machine_name: item.machine_name || '',
            equip_no: item.equip_no,
            section_code: item.section_code,
            section_name: item.section_name,
            description: item.description,
            type: 'SECTION',
            key: `${item.equip_no}-${item.section_code}`,
            children: [] = []
          }

          equip.children.push(section);
          sectionCode = item.section_code || '';
        }

        if (item.plan_code) {
          maintenance = item;
          maintenance.id = item.plan_code || '';
          maintenance.name = item.plan_name || '';
          maintenance.type = "TASK";
          maintenance.key = `${item.equip_no}-${item.section_code}-${item.plan_code}`,

          section.children.push(item);
        }
      }
      else {
        if (equipNo !== item.equip_no) {
          equip = {
            id: item.equip_no || '',
            name: item.equip_name || '',
            vessel_no: item.vessel_no,
            equip_no: item.equip_no,
            equip_name: item.equip_name,
            manufacturer: item.equip_manufacturer,
            model: item.equip_model,
            specifications: item.equip_specifications,
            type: 'EQUIPMENT',
            key: item.equip_no || '',
            children: [] = []
          }
          
          vessel.children.push(equip);
          equipNo = item.equip_no || '';
          sectionCode = '';
        }

        if (sectionCode !== item.section_code) {
          section = {
            id: item.section_code || '',
            name: item.section_name || '',
            vessel_no: item.vessel_no,
            equip_no: item.equip_no,
            section_code: item.section_code,
            section_name: item.section_name,
            description: item.description,
            type: 'SECTION',
            key: `${item.equip_no}-${item.section_code}`,
            children: [] = []
          }

          equip.children.push(section);
          sectionCode = item.section_code || '';
        }

        if (item.plan_code) {
          maintenance = item;
          maintenance.id = item.plan_code || '';
          maintenance.name = item.plan_name || '';
          maintenance.type = "TASK";
          maintenance.key = `${item.equip_no}-${item.section_code}-${item.plan_code}`,
          maintenance.children = [];
          section.children.push(item);
        }
      }
    });

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(vessel.children);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}