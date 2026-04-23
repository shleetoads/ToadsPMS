import { NextResponse } from 'next/server';
import { withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { PMSData } from '@/types/data/pms_data';

export async function POST(req: Request) {
  console.log('===Start data settings===');

  const body = await req.json();
  const receivePmsData : PMSData = body;

  try {
    // DB에서 정보 확인
    await withTransaction(async (client) => {
      let count = 0;
      
      // 선박 정보 등록 및 수정
      for (const item of receivePmsData.vessels) {
        let queryString = `
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

        let params = [
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

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }

      // 선박 기계 등록 및 수정
      for (const item of receivePmsData.machines) {
        let queryString = `
        merge machine as a
        using (select @vesselNo as vessel_no
                    , @machineName as machine_name
                    , @manufacturer as manufacturer
                    , @machineDesc as machine_desc
                    , @sortNo as sort_no
                    , @registDate as regist_date
                    , @registUser as regist_user
                    , @modifyDate as modify_date
                    , @modifyUser as modify_user) as b
          on (a.vessel_no = b.vessel_no and a.machineName = b.machineName)
        when matched then
              update
                 set machine_name = b.machine_name
                   , manufacturer = b.manufacturer
                   , machine_desc = b.machine_desc
                   , sort_no = b.sort_no
                   , last_receive_date = now()::timestamp
                   , modify_date = b.modify_date
                   , modify_user = b.modify_user
        when not matched then
              insert (vessel_no
                    , machine_name
                    , manufacturer
                    , machine_desc
                    , sort_no
                    , last_receive_date
                    , regist_date
                    , regist_user)
              values (b.vessel_no
                    , b.machine_name
                    , b.manufacturer
                    , b.machine_desc
                    , b.sort_no
                    , now()::timestamp
                    , b.regist_date
                    , b.regist_user);`;

        let params = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'machineName', value: item.machine_name },
          { name: 'manufacturer', value: item.manufacturer },
          { name: 'model', value: item.machine_desc },
          { name: 'sortNo', value: item.sort_no },
          { name: 'registDate', value: item.regist_date },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyDate', value: item.modify_date },
          { name: 'modifyUser', value: item.modify_user },
        ];

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }

      // 선박 장비 등록 및 수정
      for (const item of receivePmsData.equipments) {
        let queryString = `
        merge equipment as a
        using (select @vesselNo as vessel_no
                    , @equipNo as equip_no
                    , @equipName as equip_name
                    , @machineName as machine_name
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
                   , machine_name = b.machine_name
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
                    , machine_name
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
                    , b.machine_name
                    , b.category
                    , b.manufacturer
                    , b.model
                    , b.description
                    , now()::timestamp
                    , b.regist_date
                    , b.regist_user);`;

        let params = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'equipNo', value: item.equip_no },
          { name: 'equipName', value: item.equip_name },
          { name: 'machineName', value: item.machine_name },
          { name: 'category', value: item.category },
          { name: 'manufacturer', value: item.manufacturer },
          { name: 'model', value: item.model },
          { name: 'description', value: item.description },
          { name: 'registDate', value: item.regist_date },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyDate', value: item.modify_date },
          { name: 'modifyUser', value: item.modify_user },
        ];

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }
      
      // 선박 장비의 섹션 등록 및 수정
      for (const item of receivePmsData.sections) {
        let queryString = `
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

        let params = [
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

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }
      
      // 선박 정비 등록 및 수정
      for (const item of receivePmsData.maintenances) {
        let queryString = `
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

        let params = [
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

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }
      
      // 선박 정비 연장 등록 및 수정
      for (const item of receivePmsData.extensions) {
        let queryString = `
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

        let params = [
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

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }
      
      // 선박 정비 작업 등록 및 수정
      for (const item of receivePmsData.works) {
        let queryString = `
        merge maintenance_work as a
        using (select @vesselNo as vessel_no
                    , @workOrder as work_order
                    , @workDate as work_date
                    , @manager as manager
                    , @workDetails as work_details
                    , @usedParts as used_parts
                    , @workHours as work_hours
                    , @delayReason as delay_reason
                    , @planDate as plan_date
                    , @equipNo as equip_no
                    , @sectionCode as section_code
                    , @planCode as plan_code
                    , @registDate as regist_date
                    , @registUser as regist_user
                    , @modifyDate as modify_date
                    , @modifyUser as modify_user) as b
          on (a.vessel_no = b.vessel_no 
          and a.work_order = b.work_order)
        when matched then
              update
                 set work_date = b.work_date
                   , manager = b.manager
                   , work_details = b.work_details
                   , used_parts = b.used_parts
                   , work_hours = b.work_hours
                   , delay_reason = b.delay_reason
                   , plan_date = b.plan_date
                   , equip_no = b.equip_no
                   , section_code = b.section_code
                   , plan_code = b.plan_code
                   , modify_date = b.modify_date
                   , modify_user = b.modify_user
        when not matched then
              insert (work_order
                    , work_date
                    , manager
                    , work_details
                    , used_parts
                    , work_hours
                    , delay_reason
                    , plan_date
                    , vessel_no
                    , equip_no
                    , section_code
                    , plan_code
                    , last_receive_date
                    , regist_date
                    , regist_user)
              values (b.work_order
                    , b.work_date
                    , b.manager
                    , b.work_details
                    , b.used_parts
                    , b.work_hours
                    , b.delay_reason
                    , b.plan_date
                    , b.vessel_no
                    , b.equip_no
                    , b.section_code
                    , b.plan_code
                    , now()::timestamp
                    , b.regist_date
                    , b.regist_user);`;

        let params = [
          { name: 'workOrder', value: item.work_order },
          { name: 'workDate', value: item.work_date },
          { name: 'manager', value: item.manager },
          { name: 'workDetails', value: item.work_details },
          { name: 'usedParts', value: item.used_parts },
          { name: 'workHours', value: item.work_hours },
          { name: 'delayReason', value: item.delay_reason },
          { name: 'planDate', value: item.plan_date },
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'equipNo', value: item.equip_no },
          { name: 'sectionCode', value: item.section_code },
          { name: 'planCode', value: item.plan_code },
          { name: 'registDate', value: item.regist_date },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyDate', value: item.modify_date },
          { name: 'modifyUser', value: item.modify_user },
        ];

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }
      
      // 선박 정비 작업에 사용 부품 등록 및 수정
      for (const item of receivePmsData.usedParts) {
        let queryString = `
        merge used_parts as a
        using (select @vesselNo as vessel_no
                    , @workOrder as work_order
                    , @partSeq as part_seq
                    , @warehouseNo as warehouse_no
                    , @materialCode as material_code
                    , @useUnit as use_unit
                    , @useQty as use_qty
                    , @registDate as regist_date
                    , @registUser as regist_user
                    , @modifyDate as modify_date
                    , @modifyUser as modify_user) as b
          on (a.vessel_no = b.vessel_no 
          and a.work_order = b.work_order
          and a.part_seq = b.part_seq)
        when matched then
              update
                 set warehouse_no = b.warehouse_no
                   , material_code = b.material_code
                   , use_unit = b.use_unit
                   , use_qty = b.use_qty
                   , last_receive_date = now()::timestamp
                   , modify_date = b.modify_date
                   , modify_user = b.modify_user
        when not matched then
              insert (vessel_no
                    , work_order
                    , part_seq
                    , warehouse_no
                    , material_code
                    , use_unit
                    , use_qty
                    , last_receive_date
                    , regist_date
                    , regist_user)
              values (b.vessel_no
                    , b.work_order
                    , b.part_seq
                    , b.warehouse_no
                    , b.material_code
                    , b.use_unit
                    , b.use_qty
                    , now()::timestamp
                    , b.regist_date
                    , b.regist_user);`;

        let params = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'workOrder', value: item.work_order },
          { name: 'partSeq', value: item.part_seq },
          { name: 'warehouseNo', value: item.warehouse_no },
          { name: 'materialCode', value: item.material_code },
          { name: 'useUnit', value: item.use_unit },
          { name: 'useQty', value: item.use_qty },
          { name: 'registDate', value: item.regist_date },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyDate', value: item.modify_date },
          { name: 'modifyUser', value: item.modify_user },
        ];

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }

      // 선박 창고 등록 및 수정
      for (const item of receivePmsData.warehouses) {
        let queryString = `
        merge warehouse as a
        using (select @vesselNo as vessel_no
                    , @warehouseNo as warehouse_no
                    , @warehouseName as warehouse_name
                    , @warehouseLocation as warehouse_location
                    , @useYn as use_yn
                    , @registDate as regist_date
                    , @registUser as regist_user
                    , @modifyDate as modify_date
                    , @modifyUser as modify_user) as b
           on (a.vessel_no = b.vessel_no 
          and a.warehouseNo = b.warehouseNo)
         when matched then
              update
                 set warehouse_name = b.warehouse_name
                   , warehouse_location = b.warehouse_location
                   , use_yn = b.use_yn
                   , last_receive_date = now()::timestamp
                   , modify_date = b.modify_date
                   , modify_user = b.modify_user
         when not matched then
              insert (vessel_no
                    , warehouse_no
                    , warehouse_name
                    , warehouse_location
                    , use_yn
                    , last_receive_date
                    , regist_date
                    , regist_user)
              values (b.vessel_no
                    , b.warehouse_no
                    , b.warehouse_name
                    , b.warehouse_location
                    , b.use_yn
                    , now()::timestamp
                    , b.regist_date
                    , b.regist_user);`;

        let params = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'warehouseNo', value: item.warehouse_no },
          { name: 'warehouseName', value: item.warehouse_name },
          { name: 'warehouseLocation', value: item.warehouse_location },
          { name: 'useYn', value: item.use_yn },
          { name: 'registDate', value: item.regist_date },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyDate', value: item.modify_date },
          { name: 'modifyUser', value: item.modify_user },
        ];

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }

      // 선박 자재 등록 및 수정
      for (const item of receivePmsData.materials) {
        let queryString = `
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

        let params = [
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

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }

      // 선박 입고 등록 및 수정
      for (const item of receivePmsData.receives) {
        let queryString = `
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

        let params = [
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

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }

      // 선박 출고 등록 및 수정
      for (const item of receivePmsData.releases) {
        let queryString = `
        merge "release" as a
        using (select @vesselNo as vessel_no
                    , @releaseNo as release_no
                    , @materialCode as material_code
                    , @releaseDate as release_date
                    , @releaseType as release_type
                    , @releaseUnit as release_unit
                    , @releaseQty as release_qty
                    , @releaseLocation as release_location
                    , @releaseRemark as release_remark
                    , @releaseReason as release_reason
                    , @registDate as regist_date
                    , @registUser as regist_user
                    , @modifyDate as modify_date
                    , @modifyUser as modify_user) as b
            on (a.vessel_no = b.vessel_no 
            and a.release_no = b.release_no)
          when matched then
              update
                  set material_code = b.material_code
                    , release_date = b.release_date
                    , release_type = b.release_type
                    , release_unit = b.release_unit
                    , release_qty = b.release_qty
                    , release_location = b.release_location
                    , release_remark = b.release_remark
                    , release_reason = b.release_reason
                    , last_receive_date = now()::timestamp
                    , modify_date = b.modify_date
                    , modify_user = b.modify_user
          when not matched then
              insert (vessel_no
                    , release_no
                    , material_code
                    , release_date
                    , release_type
                    , release_unit
                    , release_qty
                    , release_location
                    , release_remark
                    , release_reason
                    , last_receive_date
                    , regist_date
                    , regist_user)
              values (b.vessel_no
                    , b.release_no
                    , b.material_code
                    , b.release_date
                    , b.release_type
                    , b.release_unit
                    , b.release_qty
                    , b.release_location
                    , b.release_remark
                    , b.release_reason
                    , now()::timestamp
                    , b.regist_date
                    , b.regist_user);`;

        let params = [
          { name: 'vesselNo', value: item.vessel_no }, 
          { name: 'releaseNo', value: item.release_no }, 
          { name: 'materialCode', value: item.material_code }, 
          { name: 'releaseDate', value: item.release_date }, 
          { name: 'releaseType', value: item.release_type }, 
          { name: 'releaseUnit', value: item.release_unit }, 
          { name: 'releaseQty', value: item.release_qty }, 
          { name: 'releaseLocation', value: item.release_location }, 
          { name: 'releaseRemark', value: item.release_remark }, 
          { name: 'releaseReason', value: item.release_reason }, 
          { name: 'registDate', value: item.regist_date },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyDate', value: item.modify_date },
          { name: 'modifyUser', value: item.modify_user },
        ];

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }

      // 선박 출고 등록 및 수정
      for (const item of receivePmsData.losses) {
        let queryString = `
        merge loss as a
        using (select @vesselNo as vessel_no
                    , @lossNo as loss_no
                    , @materialCode as material_code
                    , @lossDate as loss_date
                    , @lossType as loss_type
                    , @lossUnit as loss_unit
                    , @lossQty as loss_qty
                    , @lossLocation as loss_location
                    , @lossReason as loss_reason
                    , @registDate as regist_date
                    , @registUser as regist_user
                    , @modifyDate as modify_date
                    , @modifyUser as modify_user) as b
            on (a.vessel_no = b.vessel_no 
            and a.loss_no = b.loss_no)
          when matched then
              update
                  set material_code = b.material_code
                    , loss_date = b.loss_date
                    , loss_type = b.loss_type
                    , loss_unit = b.loss_unit
                    , loss_qty = b.loss_qty
                    , loss_location = b.loss_location
                    , loss_reason = b.loss_reason
                    , last_receive_date = now()::timestamp
                    , modify_date = b.modify_date
                    , modify_user = b.modify_user
          when not matched then
              insert (vessel_no
                    , loss_no
                    , material_code
                    , loss_date
                    , loss_type
                    , loss_unit
                    , loss_qty
                    , loss_location
                    , loss_reason
                    , last_receive_date
                    , regist_date
                    , regist_user)
              values (b.vessel_no
                    , b.loss_no
                    , b.material_code
                    , b.loss_date
                    , b.loss_type
                    , b.loss_unit
                    , b.loss_qty
                    , b.loss_location
                    , b.loss_reason
                    , now()::timestamp
                    , b.regist_date
                    , b.regist_user);`;

        let params = [
          { name: 'vesselNo', value: item.vessel_no }, 
          { name: 'lossNo', value: item.loss_no }, 
          { name: 'materialCode', value: item.material_code }, 
          { name: 'lossDate', value: item.loss_date }, 
          { name: 'lossType', value: item.loss_type }, 
          { name: 'lossUnit', value: item.loss_unit }, 
          { name: 'lossQty', value: item.loss_qty }, 
          { name: 'lossLocation', value: item.loss_location }, 
          { name: 'lossReason', value: item.loss_reason }, 
          { name: 'registDate', value: item.regist_date },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyDate', value: item.modify_date },
          { name: 'modifyUser', value: item.modify_user },
        ];

        const { text, values } = adaptNamedParams(queryString, params as NamedParam[]);
        const result = await client.query(text, values);
        count += result.rowCount ?? 0;
      }

      return count;
    });
    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}