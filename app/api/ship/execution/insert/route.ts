import { NextResponse } from 'next/server';
import { getSql, getPool, query, execute } from '@/db'; // 이전에 만든 query 함수
import { MaintenanceWork } from '@/types/vessel/maintenance_work';
import { Maintenance } from '@/types/dashboard/maintenance';

export async function POST(req: Request) {
  try {
    const remoteSiteUrl = process.env.REMOTE_SITE_URL;
    const body = await req.json();
    const item : Maintenance = body;

    const sql = await getSql();
    const pool = await getPool();
    const transantion = pool.transaction();
    await transantion.begin();
    try {
      let count = 0;
      let queryString = `
      insert into [maintenance_work] (
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
            , (select isnull(max(work_order), 0) + 1 
                 from [maintenance_work]
                where vessel_no = @vesselNo)
            , @equipNo
            , @sectionCode
            , @planCode
            , @planDate
            , getdate()
            , @manager
            , @workDetails
            , @usedParts
            , @workHours
            , @delayReason
            , getdate()
            , @registUser
            , @lastestRunHour
      );`;

      let params = [
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

      let request = new sql.Request(transantion);

      params?.forEach(p => request.input(p.name, p.value));
      let result = await request.query(queryString);
      count += result.rowsAffected[0];

      queryString = `
        EXEC dbo.usp_upsert_equipment_runtime
          @vessel_no,
          @machine_name,
          @equip_no,
          @equip_name,
          @runtime`,
      params = [
        { name: 'vessel_no', value: item.vessel_no },
        { name: 'machine_name', value: item.machine_name },
        { name: 'equip_no', value: item.equip_no },
        { name: 'equip_name', value: item.equip_name },
        { name: 'runtime', value: item.lastest_run_hour }
      ];

      request = new sql.Request(transantion);
      params?.forEach(p => request.input(p.name, p.value));
      result = await request.query(queryString);

      queryString = `
      select max(work_order) as work_order
        from [maintenance_work]
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

      request = new sql.Request(transantion);
      
      params?.forEach(p => request.input(p.name, p.value));
      result = await request.query(queryString);
      const workOrder = result.recordset[0].work_order;

      if (item.used_parts) {
        for(const part of item.used_parts) {
          queryString = `
          insert into [used_parts] (
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
              , (select isnull(max(part_seq), 0) + 1
                    from [used_parts]
                  where vessel_no = @vesselNo
                    and work_order = @workOrder)
              , @warehouseNo
              , @materialCode
              , @useUnit
              , @useQty
              , getdate()
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

          request = new sql.Request(transantion);
          params?.forEach(p => request.input(p.name, p.value));
          result = await request.query(queryString);
          
          
          queryString = `
          select max(part_seq) as part_seq
            from [used_parts]
          where vessel_no = @vesselNo
            and work_order = @workOrder;`

          params = [
            { name: 'vesselNo', value: item.vessel_no }, 
            { name: 'workOrder', value: workOrder }, 
          ];
          request = new sql.Request(transantion);
          params?.forEach(p => request.input(p.name, p.value));
          result = await request.query(queryString);

          const partSeq = result.recordset[0].part_seq;

          queryString = `
          insert into [release] (
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
              , (select 'O0' + format(getdate(), 'yyMM') + format(isnull(right(max(release_no), 3), 0) + 1, '000')
                    from [release]
                  where vessel_no = @vesselNo
                    and release_type = 'O0')
              , @materialCode
              , getdate()
              , @warehouseNo
              , 'O0'
              , @useUnit
              , @useQty
              , @workOrder
              , @partSeq
              , getdate()
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

          request = new sql.Request(transantion);
          params?.forEach(p => request.input(p.name, p.value));
          result = await request.query(queryString);
        }
      }

      queryString = `
      update maintenance_plan
         set lastest_date = getdate()
           , modify_date = getdate()
           , modify_user = @modifyUser
           , lastest_run_hour = @lastestRunHour
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
        { name: 'lastestRunHour', value: item.lastest_run_hour }, 
      ];

      request = new sql.Request(transantion);
      
      params?.forEach(p => request.input(p.name, p.value));
      result = await request.query(queryString);

      queryString = `
      update equipment
         set lastest_date = getdate()
           , modify_date = getdate()
           , modify_user = @modifyUser
       where vessel_no = @vesselNo
         and equip_no = @equipNo;`;
      
      params = [
        { name: 'vesselNo', value: item.vessel_no }, 
        { name: 'equipNo', value: item.equip_no }, 
        { name: 'registUser', value: item.regist_user }, 
        { name: 'modifyUser', value: item.modify_user }, 
      ];

      request = new sql.Request(transantion);
      
      params?.forEach(p => request.input(p.name, p.value));
      result = await request.query(queryString);

      transantion.commit();

      if (count === 0) {
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
           from [maintenance_work]
          where vessel_no = @vesselNo
            and work_order = @workOrder;`,
        [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'workOrder', value: workOrder },
        ]
      );
      
      // 선박에서 저장된 정비 정보 전송
      if (sendData[0]) {
        fetch(`${remoteSiteUrl}/api/data/execution/set`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sendData[0]),
        })
        .then(res => {
          if (res.ok) {
            // 정비 정보의 마지막 전송일자 수정
            execute(
              `update [maintenance_work]
                  set last_send_date = getdate()
                where vessel_no = @vesselNo
                  and work_order = @workOrder;`,
              [
                { name: 'vesselNo', value: sendData[0].vessel_no },
                { name: 'workOrder', value: sendData[0].work_order },
              ]
            );
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
      transantion.rollback();
      console.error(err);
      return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}