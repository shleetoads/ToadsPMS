import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { MaintenanceExtension } from '@/types/extension/maintenance_extension';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paramVesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: MaintenanceExtension[] = await query(
      `select a.vessel_no
            , e.vessel_name
            , d.machine_name
            , a.equip_no
            , d.equip_name
            , a.section_code
            , c.section_name
            , a.plan_code
            , b.plan_name
            , a.extension_seq
            , to_char(a.extension_date, 'YYYY-MM-DD') as extension_date
            , a.extension_reason
            , to_char(a.request_date, 'YYYY-MM-DD') as request_date
            , a.applicant
            , public.fn_get_user(a.applicant) as applicant_name
            , a.approval_status
            , to_char(a.approval_date, 'YYYY-MM-DD') as approval_date
            , a.approver
            , public.fn_get_user(a.approver) as approver_name
            , a.approval_reason
            , to_char(b.lastest_date, 'YYYY-MM-DD') as lastest_date
            , to_char( case b.interval_term when 'YEAR' then (b.lastest_date + make_interval(years => b.interval))
                                                        when 'MONTH' then (b.lastest_date + make_interval(months => b.interval))
                                                        when 'DAY' then (b.lastest_date + make_interval(days => b.interval))
                                                        when 'HOURS' then (b.lastest_date + make_interval(days => (b.interval / 24))) end, 'YYYY-MM-DD') as due_date
         from maintenance_extension as a
        inner join maintenance_plan as b
           on a.vessel_no = b.vessel_no
          and a.equip_no = b.equip_no
          and a.section_code = b.section_code
          and a.plan_code = b.plan_code
        inner join section as c
           on b.vessel_no = c.vessel_no
          and b.equip_no = c.equip_no
          and b.section_code = c.section_code
        inner join equipment as d
           on c.vessel_no = d.vessel_no
          and c.equip_no = d.equip_no
        inner join vessel as e
           on b.vessel_no = e.vessel_no
        where a.vessel_no = @vesselNo
          and e.use_yn = 'Y'
        order by a.vessel_no, d.machine_name, a.equip_no, a.section_code, a.plan_code, a.extension_seq`,
      [
        { name: 'vesselNo', value: paramVesselNo }
      ]    
    );

      let vessel: MaintenanceExtension = {
        id: '',
        name: '',
        vessel_no: '',
        children: [] = []
      };
    let machine: MaintenanceExtension;
    let equipment: MaintenanceExtension;
    let maintenanceExtension: MaintenanceExtension;

    let vesselNo: string = '';
    let machineName: string = '';
    let equipNo: string = '';

    items.map(item => {
      if (vesselNo !== item.vessel_no) {
        vessel = {
          id: item.vessel_no,
          name: item.vessel_name || '',
          vessel_no: item.vessel_no,
          vessel_name: item.vessel_name,
          imo_no: item.imo_no,
          type: "VESSEL",
          key: item.vessel_no,
          children: [] = []
        }

        vesselNo = item.vessel_no;
        machineName = '';
        equipNo = '';
      }
      
      if (item.machine_name !== null && item.machine_name !== '') {
        if (machineName !== item.machine_name) {
          machine = {
            id: item.machine_name || '',
            name: item.machine_name || '',
            vessel_no: item.vessel_no,
            machine_name: item.machine_name,
            type: "MACHINE",
            key: item.machine_name,
            children: [] = []
          }

          vessel?.children.push(machine);
          machineName = item.machine_name || '';
          equipNo = '';
        }
        
        if (equipNo !== item.equip_no) {
          equipment = {
            id: item.equip_no || '',
            name: item.equip_name || '',
            vessel_no: item.vessel_no,
            equip_no: item.equip_no,
            equip_name: item.equip_name,
            type: "EQUIPMENT",
            key: item.equip_no,
            children: [] = []
          }

          machine.children.push(equipment);
          equipNo = item.equip_no || '';
        }

        maintenanceExtension = item;
        maintenanceExtension.id = `${item.equip_no}-${item.section_code}-${item.plan_code}`;
        maintenanceExtension.name = item.plan_name || '';
        maintenanceExtension.type = "TASK";
        maintenanceExtension.key = `${item.equip_no}-${item.section_code}-${item.plan_code}`,

        equipment.children.push(item);
      }
      else {
        if (equipNo !== item.equip_no) {
          equipment = {
            id: item.equip_no || '',
            name: item.equip_name || '',
            vessel_no: item.vessel_no,
            equip_no: item.equip_no,
            equip_name: item.equip_name,
            type: "EQUIPMENT",
            key: item.equip_no,
            children: [] = []
          }

          vessel.children.push(equipment);
          equipNo = item.equip_no || '';
        }

        maintenanceExtension = item;
        maintenanceExtension.id = `${item.equip_no}-${item.section_code}-${item.plan_code}`;
        maintenanceExtension.name = item.plan_name || '';
        maintenanceExtension.type = "TASK";
        maintenanceExtension.key = `${item.equip_no}-${item.section_code}-${item.plan_code}`,

        equipment.children.push(item);
      }
    });

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(vessel.children);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}