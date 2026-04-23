import { NextResponse } from 'next/server';
import { withTransaction, adaptNamedParams, NamedParam, query } from '@/db';
import { MaintenanceWork } from '@/types/vessel/maintenance_work';
import { Maintenance } from '@/types/dashboard/maintenance';

export async function POST(req: Request) {
  try {
    const remoteSiteUrl = process.env.REMOTE_SITE_URL;
    const body = await req.json();
    const works : Maintenance[] = body;

    const result = await withTransaction(async (client) => {
      let count = 0;
      for (const item of works) {
        // DB에서 사용자 정보 확인

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
              , regist_date
              , regist_user
              , lastest_run_hour
        )
        values (
                @vesselNo
              , (select coalesce(max(work_order), 0) + 1
                  from maintenance_work
                  where vessel_no = @vesselNo)
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
              , @registUser
              , @lastestRunHour
        );`;

        let params: NamedParam[] = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'equipNo', value: item.equip_no },
          { name: 'sectionCode', value: item.section_code },
          { name: 'planCode', value: item.plan_code },
          { name: 'planDate', value: item.extension_date? item.extension_date : item.due_date },
          { name: 'manager', value: item.manager },
          { name: 'workDetails', value: item.work_details },
          { name: 'usedParts', value: item.used_partnames },
          { name: 'workHours', value: item.work_hours },
          { name: 'delayReason', value: item.delay_reason },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyUser', value: item.modify_user },
          { name: 'lastestRunHour', value: item.lastest_run_hour },
        ];

        let { text, values } = adaptNamedParams(queryString, params);
        let r = await client.query(text, values);
        count += r.rowCount ?? 0;

        queryString = `
          CALL usp_upsert_equipment_runtime(@vessel_no, @machine_name, @equip_no, @equip_name, @runtime)`;
        params = [
          { name: 'vessel_no', value: item.vessel_no },
          { name: 'machine_name', value: item.machine_name },
          { name: 'equip_no', value: item.equip_no },
          { name: 'equip_name', value: item.equip_name },
          { name: 'runtime', value: item.lastest_run_hour }
        ];

        ({ text, values } = adaptNamedParams(queryString, params));
        r = await client.query(text, values);

        queryString = `
        select max(work_order) as work_order
          from maintenance_work
        where vessel_no = @vesselNo
          and equip_no = @equipNo
          and section_code = @sectionCode
          and plan_code = @planCode
          and regist_user = @registUser;`

        params = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'equipNo', value: item.equip_no },
          { name: 'sectionCode', value: item.section_code },
          { name: 'planCode', value: item.plan_code },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyUser', value: item.modify_user },
        ];

        ({ text, values } = adaptNamedParams(queryString, params));
        r = await client.query(text, values);
        const workOrder = r.rows[0].work_order;

        if(item.used_parts){
          for(const part of item.used_parts) {
            queryString = `
            insert into used_parts (
                  vessel_no
                , work_order
                , part_seq
                , warehouse_no
                , material_code
                , use_unit
                , use_qty
                , regist_date
                , regist_user
            )
            values (
                  @vesselNo
                , @workOrder
                , (select coalesce(max(part_seq), 0) + 1
                      from used_parts
                    where vessel_no = @vesselNo
                      and work_order = @workOrder)
                , @warehouseNo
                , @materialCode
                , @useUnit
                , @useQty
                , now()::timestamp
                , @registUser
            );`;
            params = [
              { name: 'vesselNo', value: item.vessel_no },
              { name: 'workOrder', value: workOrder },
              { name: 'warehouseNo', value: part.warehouse_no },
              { name: 'materialCode', value: part.material_code },
              { name: 'useUnit', value: part.use_unit },
              { name: 'useQty', value: part.use_qty },
              { name: 'registUser', value: item.regist_user },
              { name: 'modifyUser', value: item.modify_user },
            ];

            ({ text, values } = adaptNamedParams(queryString, params));
            r = await client.query(text, values);


            queryString = `
            select max(part_seq) as part_seq
              from used_parts
            where vessel_no = @vesselNo
              and work_order = @workOrder;`

            params = [
              { name: 'vesselNo', value: item.vessel_no },
              { name: 'workOrder', value: workOrder },
            ];
            ({ text, values } = adaptNamedParams(queryString, params));
            r = await client.query(text, values);

            const partSeq = r.rows[0].part_seq;

            queryString = `
            insert into "release" (
                  vessel_no
                , release_no
                , material_code
                , release_date
                , release_location
                , release_type
                , release_unit
                , release_qty
                , work_order
                , part_seq
                , regist_date
                , regist_user
            )
            values (
                  @vesselNo
                , (select 'O0' || to_char(now(), 'YYMM') || lpad((coalesce(right(max(release_no), 3)::int, 0) + 1)::text, 3, '0')
                      from "release"
                    where vessel_no = @vesselNo
                      and release_type = 'O0')
                , @materialCode
                , now()::timestamp
                , @warehouseNo
                , 'O0'
                , @useUnit
                , @useQty
                , @workOrder
                , @partSeq
                , now()::timestamp
                , @registUser
            );`;
            params = [
              { name: 'vesselNo', value: item.vessel_no },
              { name: 'workOrder', value: workOrder },
              { name: 'partSeq', value: partSeq },
              { name: 'warehouseNo', value: part.warehouse_no },
              { name: 'materialCode', value: part.material_code },
              { name: 'useUnit', value: part.use_unit },
              { name: 'useQty', value: part.use_qty },
              { name: 'registUser', value: item.regist_user },
              { name: 'modifyUser', value: item.modify_user },
            ];

            ({ text, values } = adaptNamedParams(queryString, params));
            r = await client.query(text, values);
          }
        }

        queryString = `
        update maintenance_plan
           set lastest_date = now()::timestamp
             , modify_date = now()::timestamp
             , modify_user = @modifyUser
         where vessel_no = @vesselNo
           and equip_no = @equipNo
           and section_code = @sectionCode
           and plan_code = @planCode;`;

        params = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'equipNo', value: item.equip_no },
          { name: 'sectionCode', value: item.section_code },
          { name: 'planCode', value: item.plan_code },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyUser', value: item.modify_user },
        ];

        ({ text, values } = adaptNamedParams(queryString, params));
        r = await client.query(text, values);

        queryString = `
        update equipment
           set lastest_date = now()::timestamp
             , modify_date = now()::timestamp
             , modify_user = @modifyUser
         where vessel_no = @vesselNo
           and equip_no = @equipNo;`;

        params = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'equipNo', value: item.equip_no },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyUser', value: item.modify_user },
        ];

        ({ text, values } = adaptNamedParams(queryString, params));
        r = await client.query(text, values);
      }

      return count;
    });

    if (result === 0) {
      return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
    }

    // 저장된 정비 정보 조회
    const sendData: MaintenanceWork[] = await query(
      `select vessel_no
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
            , regist_date
            , regist_user
            , lastest_run_hour
          from maintenance_work
        where vessel_no = @vesselNo
          and regist_user = @registUser
          and regist_date >= to_char(now()::timestamp, 'YYYY-MM-DD');`,
      [
        { name: 'vesselNo', value: works[0].vessel_no },
        { name: 'registUser', value: works[0].regist_user },
      ]
    );

    // 선박에서 저장된 정비 정보 전송
    if (sendData[0]) {
      fetch(`${remoteSiteUrl}/api/data/execution/sets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendData),
      })
      .then(async (res) => {
        if (res.ok) {
          // 정비 정보의 마지막 전송일자 수정
          try {
            await withTransaction(async (client) => {
              for (const item of sendData) {
                const queryString =
                  `update maintenance_work
                      set last_send_date = now()::timestamp
                    where vessel_no = @vesselNo
                      and work_order = @workOrder;`

                const params: NamedParam[] = [
                  { name: 'vesselNo', value: item.vessel_no },
                  { name: 'workOrder', value: item.work_order },
                ];

                const { text, values } = adaptNamedParams(queryString, params);
                await client.query(text, values);
              }
            });
          } catch (err) {
            console.error(err);
            return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
          }
        }

        return res.json();
      })
      .catch(err => {
        console.error('Error triggering cron job:', err);
      });
    }
    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
