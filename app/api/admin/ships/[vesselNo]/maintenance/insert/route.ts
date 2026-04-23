import { NextResponse } from 'next/server';
import { execute, query } from '@/db'; // 이전에 만든 query 함수
import { MaintenancePlan } from '@/types/vessel/maintenance_plan';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item : MaintenancePlan = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `insert into maintenance_plan (
              vessel_no
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
      )
      values (
              @vesselNo
            , @equipNo
            , @sectionCode
            , (select lpad((coalesce(max(plan_code), 0) + 1)::text, 3, '0') from maintenance_plan where vessel_no = @vesselNo and equip_no = @equipNo and section_code = @sectionCode)
            , @planName
            , @manufacturer
            , @model
            , @specifications
            , @lastestDate
            , @workers
            , @workHours
            , @interval
            , @intervalTerm
            , @location
            , @selfMaintenance
            , @manager
            , @importantItems
            , @instructions
            , @critical
            , now()::timestamp
            , @registUser
      );`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'equipNo', value: item.equip_no },
        { name: 'sectionCode', value: item.section_code },
        { name: 'planCode', value: item.plan_code },
        { name: 'planName', value: item.plan_name },
        { name: 'manufacturer', value: item.manufacturer },
        { name: 'model', value: item.model },
        { name: 'specifications', value: item.specifications },
        { name: 'lastestDate', value: item.lastest_date },
        { name: 'workers', value: item.workers },
        { name: 'workHours', value: item.work_hours },
        { name: 'interval', value: item.interval },
        { name: 'intervalTerm', value: item.interval_term },
        { name: 'location', value: item.location },
        { name: 'selfMaintenance', value: item.self_maintenance },
        { name: 'manager', value: item.manager },
        { name: 'importantItems', value: item.important_items },
        { name: 'instructions', value: item.instructions },
        { name: 'critical', value: item.critical },
        { name: 'registUser', value: item.regist_user }
      ]
    );

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
    }
            
    const plans: MaintenancePlan[] = await query(
      `select max(plan_code) as plan_code
         from maintenance_plan
        where vessel_no = @vesselNo
          and equip_no = @equipNo
          and section_code = @sectionCode
          and regist_user = @registUser`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'equipNo', value: item.equip_no },
        { name: 'sectionCode', value: item.section_code },
        { name: 'registUser', value: item.regist_user },
      ]
    );

    if (plans && plans.length > 0) {
      const max_plan_code = plans[0].plan_code;

      // 성공 정보 반환
      return NextResponse.json({ success: true, plan_code: max_plan_code });
    }
    
      return NextResponse.json({ success: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}