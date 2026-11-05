import { NextResponse } from 'next/server';
import { query, withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { Material } from '@/types/inventory/material/material';

export async function POST(req: Request) {
  try {
    const remoteSiteUrl = process.env.REMOTE_SITE_URL;
    const body = await req.json();
    const item : Material = body;

    const count = await withTransaction(async (client) => {
      let total = 0;
      let queryString = `
      insert into material (
              vessel_no
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
      )
      values (
              @vesselNo
            , (select 'A' || @materialType || to_char(now(), 'YYMM') || lpad((coalesce(right(max(material_code), 3)::int, 0) + 1)::text, 3, '0')
                 from material
                where vessel_no = @vesselNo
                  and material_type = @materialType
                  and material_code like 'A%')
            , @machineName
            , @materialName
            , @materialGroup
            , @materialSpec
            , @materialType
            , @materialUnit
            , @warehouseNo
            , @drawingNo
            , @standardQty
            , now()::timestamp
            , @registUser
      )
      on conflict (vessel_no, material_code) do update
         set machine_name = excluded.machine_name
           , material_name = excluded.material_name
           , material_group = excluded.material_group
           , material_spec = excluded.material_spec
           , material_type = excluded.material_type
           , material_unit = excluded.material_unit
           , warehouse_no = excluded.warehouse_no
           , drawing_no = excluded.drawing_no
           , standard_qty = excluded.standard_qty
           , modify_date = now()::timestamp
           , modify_user = excluded.regist_user
           , delete_yn = 'N';`;

      let params: NamedParam[] = [
        { name: 'vesselNo', value: item.vessel_no },
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
        { name: 'registUser', value: item.regist_user },
        { name: 'modifyUser', value: item.modify_user },
      ];

      let { text, values } = adaptNamedParams(queryString, params);
      let result = await client.query(text, values);
      total += result.rowCount ?? 0;

      queryString = `
      merge receive as a
      using (select a1.vessel_no
                  , a1.material_code
                  , a1.material_unit as receive_unit
                  , a1.warehouse_no as receive_location
                  , @initialStock as receive_qty
                  , 'S0' as receive_type
                  , @registUser as regist_user
                  , @modifyUser as modify_user
               from material as a1
              where a1.vessel_no = @vesselNo
                and a1.machine_name = @machineName
                and a1.material_code = (select max(material_code)
                                          from material
                                         where vessel_no = @vesselNo
                                           and machine_name = @machineName
                                           and regist_user = @registUser
                                           and material_code like 'A%')) as b
         on (a.vessel_no = b.vessel_no
             and a.material_code = b.material_code
             and a.receive_type = b.receive_type)
       when matched then
            update
               set receive_unit = b.receive_unit
                 , receive_qty = b.receive_qty
                 , receive_location = b.receive_location
                 , modify_date = now()::timestamp
                 , modify_user = b.modify_user
       when not matched then
            insert (vessel_no
                  , receive_no
                  , material_code
                  , receive_unit
                  , receive_type
                  , receive_qty
                  , receive_location
                  , regist_date
                  , regist_user)
            values (b.vessel_no
                  , (select 'A' || b.receive_type || to_char(now(), 'YYMM') || lpad((coalesce(right(max(receive_no), 3)::int, 0) + 1)::text, 3, '0')
                       from receive
                      where vessel_no = b.vessel_no
                        and receive_type = b.receive_type
                        and receive_no like 'A%')
                  , b.material_code
                  , b.receive_unit
                  , b.receive_type
                  , b.receive_qty
                  , b.receive_location
                  , now()::timestamp
                  , b.regist_user);`;
      params = [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'machineName', value: item.machine_name },
        { name: 'initialStock', value: item.initial_stock },
        { name: 'registUser', value: item.regist_user },
        { name: 'modifyUser', value: item.modify_user },
      ];

      ({ text, values } = adaptNamedParams(queryString, params));
      result = await client.query(text, values);
      total += result.rowCount ?? 0;

      return total;
    });

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
    }

    // 저장된 자재 정보 조회
    const sendData: Material[] = await query(
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
          from material
        where vessel_no = @vesselNo
          and material_code = (select max(material_code)
                                 from material
                                where vessel_no = @vesselNo
                                  and machine_name = @machineName
                                  and regist_user = @registUser)
          and coalesce(delete_yn, 'N') = 'N';`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'machineName', value: item.machine_name },
        { name: 'registUser', value: item.regist_user },
      ]
    );

    // 성공 정보 반환
    return NextResponse.json({ success: true, data: sendData[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
