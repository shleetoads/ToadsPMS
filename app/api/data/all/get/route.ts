import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { PMSData } from '@/types/data/pms_data';
import { Vessel } from '@/types/vessel/vessel';
import { Machine } from '@/types/vessel/machine';
import { Equipment } from '@/types/vessel/equipment';
import { Section } from '@/types/vessel/section';
import { MaintenancePlan } from '@/types/vessel/maintenance_plan';
import { MaintenanceExtension } from '@/types/vessel/maintenance_extension';
import { Material } from '@/types/inventory/material/material';
import { Receive } from '@/types/inventory/receive/receive';

export async function POST(req: Request) {
  console.log('===Start data gettings===');

  const body = await req.json();
  const receivePmsData : PMSData = body;

  if (!receivePmsData.last_receive_date) {
    receivePmsData.last_receive_date = '1900-01-01';
  }

  try {
    const vessels: Vessel[] = await query(
      `select vessel_no
            , vessel_name
            , imo_no
            , use_yn
            , vessel_short_name
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from vessel
        where vessel_no = @vesselNo
          and (regist_date >= @lastReceiveDate or modify_date >= @lastReceiveDate)`,
      [
        { name: 'vesselNo', value: receivePmsData.vessel_no },
        { name: 'lastReceiveDate', value: receivePmsData.last_receive_date }
      ]
    );

    const machines: Machine[] = await query(
      `select vessel_no
            , machine_name
            , manufacturer
            , machine_desc
            , sort_no
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from machine
        where vessel_no = @vesselNo
          and (regist_date >= @lastReceiveDate or modify_date >= @lastReceiveDate)`,
      [
        { name: 'vesselNo', value: receivePmsData.vessel_no },
        { name: 'lastReceiveDate', value: receivePmsData.last_receive_date }
      ]
    );

    const equipments: Equipment[] = await query(
      `select vessel_no
            , equip_no
            , equip_name
            , machine_name
            , manufacturer
            , model
            , specifications
            , description
            , category
            , lastest_date
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from equipment
        where vessel_no = @vesselNo
          and (regist_date >= @lastReceiveDate or modify_date >= @lastReceiveDate)`,
      [
        { name: 'vesselNo', value: receivePmsData.vessel_no },
        { name: 'lastReceiveDate', value: receivePmsData.last_receive_date }
      ]
    );

    const sections: Section[] = await query(
      `select vessel_no
            , equip_no
            , section_code
            , section_name
            , description
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from section
        where vessel_no = @vesselNo
          and (regist_date >= @lastReceiveDate or modify_date >= @lastReceiveDate)`,
      [
        { name: 'vesselNo', value: receivePmsData.vessel_no },
        { name: 'lastReceiveDate', value: receivePmsData.last_receive_date }
      ]
    );
    
    const maintenances: MaintenancePlan[] = await query(
      `select vessel_no
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
            , important_items
            , instructions
            , critical
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from maintenance_plan
        where vessel_no = @vesselNo
          and (regist_date >= @lastReceiveDate or modify_date >= @lastReceiveDate)`,
      [
        { name: 'vesselNo', value: receivePmsData.vessel_no },
        { name: 'lastReceiveDate', value: receivePmsData.last_receive_date }
      ]
    );
    
    const extensions: MaintenanceExtension[] = await query(
      `select vessel_no
            , equip_no
            , section_code
            , plan_code
            , extension_seq
            , extension_date
            , extension_reason
            , request_date
            , applicant
            , approval_status
            , approval_date
            , approver
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from maintenance_extension
        where vessel_no = @vesselNo
          and (regist_date >= @lastReceiveDate or modify_date >= @lastReceiveDate)`,
      [
        { name: 'vesselNo', value: receivePmsData.vessel_no },
        { name: 'lastReceiveDate', value: receivePmsData.last_receive_date }
      ]
    );

    const materials: Material[] = await query(
      `select vessel_no
            , material_code
            , machine_name
            , material_name
            , material_group
            , material_spec
            , material_type
            , material_unit
            , warehouse_no
            , drawing_no
            , standard_qty
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from material
        where vessel_no = @vesselNo
          and (regist_date >= @lastReceiveDate or modify_date >= @lastReceiveDate)`,
      [
        { name: 'vesselNo', value: receivePmsData.vessel_no },
        { name: 'lastReceiveDate', value: receivePmsData.last_receive_date }
      ]
    );

    const receives: Receive[] = await query(
      `select vessel_no
            , receive_no
            , material_code
            , receive_date
            , receive_location
            , receive_type
            , receive_unit
            , receive_qty
            , receive_remark
            , delivery_location
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from receive
        where vessel_no = @vesselNo
          and (regist_date >= @lastReceiveDate or modify_date >= @lastReceiveDate)
          and receive_type = 'S0'`,
      [
        { name: 'vesselNo', value: receivePmsData.vessel_no },
        { name: 'lastReceiveDate', value: receivePmsData.last_receive_date }
      ]
    );
    
    const sendPmsData : PMSData = {
      vessel_no: receivePmsData.vessel_no,
      last_receive_date: receivePmsData.last_receive_date,
      vessels: vessels,
      machines: machines,
      equipments: equipments,
      sections: sections,
      maintenances: maintenances,
      extensions: extensions,
      works: [],
      usedParts: [],
      warehouses: [],
      materials: materials,
      receives: receives,
      releases: [],
      losses: []
    };

    // 성공 시 정보 반환
    return NextResponse.json(sendPmsData);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}