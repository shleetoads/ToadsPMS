import { NextResponse } from 'next/server';
import { withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { MaintenanceWork } from '@/types/vessel/maintenance_work';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item : MaintenanceWork = body;

    const count = await withTransaction(async (client) => {
      let total = 0;
      let queryString = `
      update maintenance_plan
         set lastest_date = @workDate
           , modify_date = now()::timestamp
           , modify_user = @modifyUser
       where vessel_no = @vesselNo
         and equip_no = @equipNo
         and section_code = @sectionCode
         and plan_code = @planCode
         and lastest_date = (select work_date
                               from maintenance_work
                              where vessel_no = @vesselNo
                                and work_order = @workOrder);`;

      let params: NamedParam[] = [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'equipNo', value: item.equip_no },
        { name: 'sectionCode', value: item.section_code },
        { name: 'planCode', value: item.plan_code },
        { name: 'workOrder', value: item.work_order.toString() },
        { name: 'workDate', value: item.work_date },
        { name: 'registUser', value: item.regist_user },
        { name: 'modifyUser', value: item.modify_user },
      ];

      let { text, values } = adaptNamedParams(queryString, params);
      let result = await client.query(text, values);

      queryString = `
      update equipment
         set lastest_date = @workDate
           , modify_date = now()::timestamp
           , modify_user = @modifyUser
       where vessel_no = @vesselNo
         and equip_no = @equipNo
         and lastest_date = (select work_date
                               from maintenance_work
                              where vessel_no = @vesselNo
                                and work_order = @workOrder);`;

      params = [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'equipNo', value: item.equip_no },
        { name: 'workOrder', value: item.work_order.toString() },
        { name: 'workDate', value: item.work_date },
        { name: 'registUser', value: item.regist_user },
        { name: 'modifyUser', value: item.modify_user },
      ];

      ({ text, values } = adaptNamedParams(queryString, params));
      result = await client.query(text, values);

      queryString = `
      update maintenance_work
         set work_date = @workDate
           , modify_user = @modifyUser
           , modify_date = now()::timestamp
       where vessel_no = @vesselNo
         and work_order = @workOrder;`;

      params = [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'workOrder', value: item.work_order.toString() },
        { name: 'workDate', value: item.work_date },
        { name: 'registUser', value: item.regist_user },
        { name: 'modifyUser', value: item.modify_user },
      ];

      ({ text, values } = adaptNamedParams(queryString, params));
      result = await client.query(text, values);
      total += result.rowCount ?? 0;

      return total;
    });

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not updated.' }, { status: 401 });
    }

    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
