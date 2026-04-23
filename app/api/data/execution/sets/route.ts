import { NextResponse } from 'next/server';
import { withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { MaintenanceWork } from '@/types/vessel/maintenance_work';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items : MaintenanceWork[] = body;

    const count = await withTransaction(async (client) => {
      let total = 0;
      for (const item of items) {
        let queryString = `
        insert into maintenance_work (
                vessel_no
              , work_order
              , equip_no
              , section_code
              , plan_code
              , plan_date
              , work_date
              , manager
              , work_details
              , used_parts
              , work_hours
              , delay_reason
              , last_receive_date
              , regist_date
              , regist_user
        )
        values (
                @vesselNo
              , @workOrder
              , @equipNo
              , @sectionCode
              , @planCode
              , @planDate
              , now()::timestamp
              , @manager
              , @workDetails
              , @usedParts
              , @workHours
              , @delayReason
              , now()::timestamp
              , now()::timestamp
              , @registUser
        );`;

        const params: NamedParam[] = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'workOrder', value: item.work_order },
          { name: 'equipNo', value: item.equip_no },
          { name: 'sectionCode', value: item.section_code },
          { name: 'planCode', value: item.plan_code },
          { name: 'planDate', value: item.extension_date? item.extension_date : item.due_date },
          { name: 'manager', value: item.manager },
          { name: 'workDetails', value: item.work_details },
          { name: 'usedParts', value: item.used_parts },
          { name: 'workHours', value: item.work_hours },
          { name: 'delayReason', value: item.delay_reason },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyUser', value: item.modify_user },
        ];

        let { text, values } = adaptNamedParams(queryString, params);
        let result = await client.query(text, values);
        total += result.rowCount ?? 0;

        queryString = `
        update maintenance_plan
           set lastest_date = now()::timestamp
             , modify_date = now()::timestamp
             , modify_user = @modifyUser
         where vessel_no = @vesselNo
           and equip_no = @equipNo
           and section_code = @sectionCode
           and plan_code = @planCode;`;

        ({ text, values } = adaptNamedParams(queryString, params));
        result = await client.query(text, values);

        queryString = `
        update equipment
           set lastest_date = now()::timestamp
             , modify_date = now()::timestamp
             , modify_user = @modifyUser
         where vessel_no = @vesselNo
           and equip_no = @equipNo;`;

        ({ text, values } = adaptNamedParams(queryString, params));
        result = await client.query(text, values);
      }

      return total;
    });

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
    }

    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
