import { NextResponse } from 'next/server';
import { query, withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { PMSData } from '@/types/data/pms_data';

export async function GET(req: Request) {
  const remoteSiteUrl = process.env.REMOTE_SITE_URL;
  let vesselNo = process.env.VESSEL;
  if (!vesselNo)
    vesselNo = ''

  if (!remoteSiteUrl)
    return NextResponse.json({ success: true });

  try {
    const lastReceiveDates: any[] = await query(
      `select max(a.last_receive_date) as last_receive_date
         from (select last_receive_date
                 from vessel
                where vessel_no = @vesselNo
               union all
               select last_receive_date
                 from equipment
                where vessel_no = @vesselNo
               union all
               select last_receive_date
                 from section
                where vessel_no = @vesselNo
               union all
               select last_receive_date
                 from maintenance_plan
                where vessel_no = @vesselNo
               union all
               select last_receive_date
                 from maintenance_extension
                where vessel_no = @vesselNo
               union all
               select last_receive_date
                 from maintenance_work
                where vessel_no = @vesselNo
               union all
               select last_receive_date
                 from material
                where vessel_no = @vesselNo
               union all
               select last_receive_date
                 from receive
                where vessel_no = @vesselNo) as a`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const sendPmsData : PMSData = {
      vessel_no: vesselNo,
      last_receive_date: lastReceiveDates[0].last_receive_date,
      vessels: [],
      equipments: [],
      sections: [],
      maintenances: [],
      extensions: [],
      works: [],
      machines: [],
      usedParts: [],
      warehouses: [],
      materials: [],
      receives: [],
      releases: [],
      losses: []
    };

    const response = await fetch(`${remoteSiteUrl}/api/data/all/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendPmsData),
    });

    if (response.ok) {
      const receivePmsData = await response.json();

      const jsonString = JSON.stringify(receivePmsData);
      const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');
      const sizeInKB = (sizeInBytes / 1024).toFixed(2);
      const sizeInMB = (sizeInBytes / 1024 / 1024).toFixed(2);

      // 4. 서버 로그에 크기를 출력합니다.
      console.log(`[Server Log] Response JSON Size: ${sizeInKB} KB (${sizeInMB} MB)`);

      await withTransaction(async (client) => {
        let count = 0;
        // 선박 정보 등록 및 수정
        for (const item of receivePmsData.vessels) {
          const queryString = `
          merge vessel as a
          using (select @vesselNo as vessel_no
                      , @vesselName as vessel_name
                      , @vesselShortName as vessel_short_name
                      , @imoNo as imo_no
                      , @useYn as use_yn
                      , @registDate as regist_date
                      , @registUser as regist_user
                      , @modifyDate as modify_date
                      , @modifyUser as modify_user) as b
            on (a.vessel_no = b.vessel_no)
          when matched then
                update
                  set vessel_name = b.vessel_name
                    , vessel_short_name = b.vessel_short_name
                    , imo_no = b.imo_no
                    , use_yn = b.use_yn
                    , last_receive_date = now()::timestamp
                    , modify_date = b.modify_date
                    , modify_user = b.modify_user
          when not matched then
                insert (vessel_no
                      , vessel_name
                      , vessel_short_name
                      , imo_no
                      , use_yn
                      , last_receive_date
                      , regist_date
                      , regist_user)
                values (b.vessel_no
                      , b.vessel_name
                      , b.vessel_short_name
                      , b.imo_no
                      , b.use_yn
                      , now()::timestamp
                      , b.regist_date
                      , b.regist_user);`;

          const params: NamedParam[] = [
            { name: 'vesselNo', value: item.vessel_no },
            { name: 'vesselName', value: item.vessel_name },
            { name: 'vesselShortName', value: item.vessel_short_name },
            { name: 'imoNo', value: item.imo_no },
            { name: 'useYn', value: item.use_yn },
            { name: 'registDate', value: item.regist_date },
            { name: 'registUser', value: item.regist_user },
            { name: 'modifyDate', value: item.modify_date },
            { name: 'modifyUser', value: item.modify_user },
          ];

          const { text, values } = adaptNamedParams(queryString, params);
          const result = await client.query(text, values);
          count += result.rowCount ?? 0;
        }

        // 선박 장비 등록 및 수정
        for (const item of receivePmsData.equipments) {
          const queryString = `
          merge equipment as a
          using (select @vesselNo as vessel_no
                      , @equipNo as equip_no
                      , @equipName as equip_name
                      , @category as category
                      , @manufacturer as manufacturer
                      , @model as model
                      , @description as description
                      , @registDate as regist_date
                      , @registUser as regist_user
                      , @modifyDate as modify_date
                      , @modifyUser as modify_user) as b
            on (a.vessel_no = b.vessel_no and a.equip_no = b.equip_no)
          when matched then
                update
                  set equip_name = b.equip_name
                    , category = b.category
                    , manufacturer = b.manufacturer
                    , model = b.model
                    , description = b.description
                    , last_receive_date = now()::timestamp
                    , modify_date = b.modify_date
                    , modify_user = b.modify_user
          when not matched then
                insert (vessel_no
                      , equip_no
                      , equip_name
                      , category
                      , manufacturer
                      , model
                      , description
                      , last_receive_date
                      , regist_date
                      , regist_user)
                values (b.vessel_no
                      , b.equip_no
                      , b.equip_name
                      , b.category
                      , b.manufacturer
                      , b.model
                      , b.description
                      , now()::timestamp
                      , b.regist_date
                      , b.regist_user);`;

          const params: NamedParam[] = [
            { name: 'vesselNo', value: item.vessel_no },
            { name: 'equipNo', value: item.equip_no },
            { name: 'equipName', value: item.equip_name },
            { name: 'category', value: item.category },
            { name: 'manufacturer', value: item.manufacturer },
            { name: 'model', value: item.model },
            { name: 'description', value: item.description },
            { name: 'registDate', value: item.regist_date },
            { name: 'registUser', value: item.regist_user },
            { name: 'modifyDate', value: item.modify_date },
            { name: 'modifyUser', value: item.modify_user },
          ];

          const { text, values } = adaptNamedParams(queryString, params);
          const result = await client.query(text, values);
          count += result.rowCount ?? 0;
        }

        // 선박 장비의 섹션 등록 및 수정
        for (const item of receivePmsData.sections) {
          const queryString = `
          merge section as a
          using (select @vesselNo as vessel_no
                      , @equipNo as equip_no
                      , @sectionCode as section_code
                      , @sectionName as section_name
                      , @description as description
                      , @registDate as regist_date
                      , @registUser as regist_user
                      , @modifyDate as modify_date
                      , @modifyUser as modify_user) as b
            on (a.vessel_no = b.vessel_no and a.equip_no = b.equip_no and a.section_code = b.section_code)
          when matched then
                update
                  set section_name = b.section_name
                    , description = b.description
                    , last_receive_date = now()::timestamp
                    , modify_date = b.modify_date
                    , modify_user = b.modify_user
          when not matched then
                insert (vessel_no
                      , equip_no
                      , section_code
                      , section_name
                      , description
                      , last_receive_date
                      , regist_date
                      , regist_user)
                values (b.vessel_no
                      , b.equip_no
                      , b.section_code
                      , b.section_name
                      , b.description
                      , now()::timestamp
                      , b.regist_date
                      , b.regist_user);`;

          const params: NamedParam[] = [
            { name: 'vesselNo', value: item.vessel_no },
            { name: 'equipNo', value: item.equip_no },
            { name: 'sectionCode', value: item.section_code },
            { name: 'sectionName', value: item.section_name },
            { name: 'description', value: item.description },
            { name: 'registDate', value: item.regist_date },
            { name: 'registUser', value: item.regist_user },
            { name: 'modifyDate', value: item.modify_date },
            { name: 'modifyUser', value: item.modify_user },
          ];

          const { text, values } = adaptNamedParams(queryString, params);
          const result = await client.query(text, values);
          count += result.rowCount ?? 0;
        }

        // 선박 정비 등록 및 수정
        for (const item of receivePmsData.maintenances) {
          const queryString = `
          merge maintenance_plan as a
          using (select @vesselNo as vessel_no
                      , @equipNo as equip_no
                      , @sectionCode as section_code
                      , @planCode as plan_code
                      , @planName as plan_name
                      , @manufacturer as manufacturer
                      , @model as model
                      , @specifications as specifications
                      , @lastestDate as lastest_date
                      , @workers as workers
                      , @workHours as work_hours
                      , @interval as interval
                      , @intervalTerm as interval_term
                      , @location as location
                      , @selfMaintenance as self_maintenance
                      , @manager as manager
                      , @importantItems as important_items
                      , @instructions as instructions
                      , @critical as critical
                      , @registDate as regist_date
                      , @registUser as regist_user
                      , @modifyDate as modify_date
                      , @modifyUser as modify_user) as b
            on (a.vessel_no = b.vessel_no
            and a.equip_no = b.equip_no
            and a.section_code = b.section_code
            and a.plan_code = b.plan_code)
          when matched then
                update
                   set plan_name = b.plan_name
                     , manufacturer = b.manufacturer
                     , model = b.model
                     , specifications = b.specifications
                     , lastest_date = b.lastest_date
                     , workers = b.workers
                     , work_hours = b.work_hours
                     , interval = b.interval
                     , interval_term = b.interval_term
                     , location = b.location
                     , self_maintenance = b.self_maintenance
                     , manager = b.manager
                     , important_items = b.important_items
                     , instructions = b.instructions
                     , critical = b.critical
                     , last_receive_date = now()::timestamp
                     , modify_date = b.modify_date
                     , modify_user = b.modify_user
          when not matched then
                insert (vessel_no
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
                      , last_receive_date
                      , regist_date
                      , regist_user)
                values (b.vessel_no
                      , b.equip_no
                      , b.section_code
                      , b.plan_code
                      , b.plan_name
                      , b.manufacturer
                      , b.model
                      , b.specifications
                      , b.lastest_date
                      , b.workers
                      , b.work_hours
                      , b.interval
                      , b.interval_term
                      , b.location
                      , b.self_maintenance
                      , b.manager
                      , b.important_items
                      , b.instructions
                      , b.critical
                      , now()::timestamp
                      , b.regist_date
                      , b.regist_user);`;

          const params: NamedParam[] = [
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
            { name: 'registDate', value: item.regist_date },
            { name: 'registUser', value: item.regist_user },
            { name: 'modifyDate', value: item.modify_date },
            { name: 'modifyUser', value: item.modify_user },
          ];

          const { text, values } = adaptNamedParams(queryString, params);
          const result = await client.query(text, values);
          count += result.rowCount ?? 0;
        }

        // 선박 정비 연장 등록 및 수정
        for (const item of receivePmsData.extensions) {
          const queryString = `
          merge maintenance_extension as a
          using (select @vesselNo as vessel_no
                      , @equipNo as equip_no
                      , @sectionCode as section_code
                      , @planCode as plan_code
                      , @extensionSeq as extension_seq
                      , @extensionDate as extension_date
                      , @extensionReason as extension_reason
                      , @requestDate as request_date
                      , @applicant as applicant
                      , @approvalStatus as approval_status
                      , @approvalDate as approval_date
                      , @approver as approver
                      , @registDate as regist_date
                      , @registUser as regist_user
                      , @modifyDate as modify_date
                      , @modifyUser as modify_user) as b
            on (a.vessel_no = b.vessel_no
            and a.equip_no = b.equip_no
            and a.section_code = b.section_code
            and a.plan_code = b.plan_code
            and a.extension_seq = b.extension_seq)
          when matched then
                update
                   set extension_date = b.extension_date
                     , extension_reason = b.extension_reason
                     , request_date = b.request_date
                     , applicant = b.applicant
                     , approval_status = b.approval_status
                     , approval_date = b.approval_date
                     , approver = b.approver
                     , last_receive_date = now()::timestamp
                     , modify_date = b.modify_date
                     , modify_user = b.modify_user
          when not matched then
                insert (vessel_no
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
                      , last_receive_date
                      , regist_date
                      , regist_user)
                values (b.vessel_no
                      , b.equip_no
                      , b.section_code
                      , b.plan_code
                      , b.extension_seq
                      , b.extension_date
                      , b.extension_reason
                      , b.request_date
                      , b.applicant
                      , b.approval_status
                      , b.approval_date
                      , b.approver
                      , now()::timestamp
                      , b.regist_date
                      , b.regist_user);`;

          const params: NamedParam[] = [
            { name: 'vesselNo', value: item.vessel_no },
            { name: 'equipNo', value: item.equip_no },
            { name: 'sectionCode', value: item.section_code },
            { name: 'planCode', value: item.plan_code },
            { name: 'extensionSeq', value: item.extension_seq },
            { name: 'extensionDate', value: item.extension_date },
            { name: 'extensionReason', value: item.extension_reason },
            { name: 'requestDate', value: item.request_date },
            { name: 'applicant', value: item.applicant },
            { name: 'approvalStatus', value: item.approval_status },
            { name: 'approvalDate', value: item.approval_date },
            { name: 'approver', value: item.approver },
            { name: 'registDate', value: item.regist_date },
            { name: 'registUser', value: item.regist_user },
            { name: 'modifyDate', value: item.modify_date },
            { name: 'modifyUser', value: item.modify_user },
          ];

          const { text, values } = adaptNamedParams(queryString, params);
          const result = await client.query(text, values);
          count += result.rowCount ?? 0;
        }

        // 선박의 부품 등록 및 수정
        for (const item of receivePmsData.materials) {
          const queryString = `
          merge material as a
          using (select @vesselNo as vessel_no
                      , @materialCode as material_code
                      , @machineName as machine_name
                      , @materialName as material_name
                      , @materialGroup as material_group
                      , @materialSpec as material_spec
                      , @materialType as material_type
                      , @materialUnit as material_unit
                      , @warehouseNo as warehouse_no
                      , @drawingNo as drawing_no
                      , @standardQty as standard_qty
                      , @registDate as regist_date
                      , @registUser as regist_user
                      , @modifyDate as modify_date
                      , @modifyUser as modify_user) as b
              on (a.vessel_no = b.vessel_no
              and a.material_code = b.material_code)
            when matched then
                update
                   set machine_name = b.machine_name
                     , material_name = b.material_name
                     , material_group = b.material_group
                     , material_spec = b.material_spec
                     , material_type = b.material_type
                     , material_unit = b.material_unit
                     , warehouse_no = b.warehouse_no
                     , drawing_no = b.drawing_no
                     , standard_qty = b.standard_qty
                     , last_receive_date = now()::timestamp
                     , modify_date = b.modify_date
                     , modify_user = b.modify_user
            when not matched then
                insert (vessel_no
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
                      , last_receive_date
                      , regist_date
                      , regist_user)
                values (b.vessel_no
                      , b.material_code
                      , b.machine_name
                      , b.material_name
                      , b.material_group
                      , b.material_spec
                      , b.material_type
                      , b.material_unit
                      , b.warehouse_no
                      , b.drawing_no
                      , b.standard_qty
                      , now()::timestamp
                      , b.regist_date
                      , b.regist_user);`;

          const params: NamedParam[] = [
            { name: 'vesselNo', value: item.vessel_no },
            { name: 'materialCode', value: item.material_code },
            { name: 'machineName', value: item.machine_name },
            { name: 'materialName', value: item.material_name },
            { name: 'materialGroup', value: item.material_group },
            { name: 'materialSpec', value: item.material_spec },
            { name: 'materialType', value: item.material_type },
            { name: 'materialUnit', value: item.material_unit },
            { name: 'warehouseNo', value: item.warehouse_no },
            { name: 'drawingNo', value: item.drawing_no },
            { name: 'standardQty', value: item.standard_qty },
            { name: 'initialStock', value: item.initial_stock },
            { name: 'registDate', value: item.regist_date },
            { name: 'registUser', value: item.regist_user },
            { name: 'modifyDate', value: item.modify_date },
            { name: 'modifyUser', value: item.modify_user },
          ];

          const { text, values } = adaptNamedParams(queryString, params);
          const result = await client.query(text, values);
          count += result.rowCount ?? 0;
        }

        // 선박의 부품 입고 등록 및 수정
        for (const item of receivePmsData.receives) {
          const queryString = `
          merge receive as a
          using (select @vesselNo as vessel_no
                      , @receiveNo as receive_no
                      , @materialCode as material_code
                      , @receiveDate as receive_date
                      , @deliveryLocation as delivery_location
                      , @receiveType as receive_type
                      , @receiveUnit as receive_unit
                      , @receiveQty as receive_qty
                      , @receiveLocation as receive_location
                      , @receiveRemark as receive_remark
                      , @registDate as regist_date
                      , @registUser as regist_user
                      , @modifyDate as modify_date
                      , @modifyUser as modify_user) as b
              on (a.vessel_no = b.vessel_no
              and a.receive_no = b.receive_no)
            when matched then
                update
                   set material_code = b.material_code
                     , receive_date = b.receive_date
                     , delivery_location = b.delivery_location
                     , receive_type = b.receive_type
                     , receive_unit = b.receive_unit
                     , receive_qty = b.receive_qty
                     , receive_location = b.receive_location
                     , receive_remark = b.receive_remark
                     , last_receive_date = now()::timestamp
                     , modify_date = b.modify_date
                     , modify_user = b.modify_user
            when not matched then
                insert (vessel_no
                      , receive_no
                      , material_code
                      , receive_date
                      , delivery_location
                      , receive_type
                      , receive_unit
                      , receive_qty
                      , receive_location
                      , receive_remark
                      , last_receive_date
                      , regist_date
                      , regist_user)
                values (b.vessel_no
                      , b.receive_no
                      , b.material_code
                      , b.receive_date
                      , b.delivery_location
                      , b.receive_type
                      , b.receive_unit
                      , b.receive_qty
                      , b.receive_location
                      , b.receive_remark
                      , now()::timestamp
                      , b.regist_date
                      , b.regist_user);`;

          const params: NamedParam[] = [
            { name: 'vesselNo', value: item.vessel_no },
            { name: 'receiveNo', value: item.receive_no },
            { name: 'materialCode', value: item.material_code },
            { name: 'receiveDate', value: item.receive_date },
            { name: 'deliveryLocation', value: item.delivery_location },
            { name: 'receiveType', value: item.receive_type },
            { name: 'receiveUnit', value: item.receive_unit },
            { name: 'receiveQty', value: item.receive_qty },
            { name: 'receiveLocation', value: item.receive_location },
            { name: 'receiveRemark', value: item.receive_remark },
            { name: 'registDate', value: item.regist_date },
            { name: 'registUser', value: item.regist_user },
            { name: 'modifyDate', value: item.modify_date },
            { name: 'modifyUser', value: item.modify_user },
          ];

          const { text, values } = adaptNamedParams(queryString, params);
          const result = await client.query(text, values);
          count += result.rowCount ?? 0;
        }

        return count;
      });
      // 성공 정보 반환
      return NextResponse.json({ success: true });
    }
    else {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
