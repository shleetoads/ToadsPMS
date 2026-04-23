import { NextResponse } from 'next/server';
import { withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { Material } from '@/types/inventory/material/material';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item : Material = body;

    const count = await withTransaction(async (client) => {
      let total = 0;
      let queryString = `
      update material
         set material_name = @materialName
           , material_group = @materialGroup
           , material_spec = @materialSpec
           , material_type = @materialType
           , material_unit = @materialUnit
           , warehouse_no = @warehouseNo
           , drawing_no = @drawingNo
           , standard_qty = @standardQty
           , modify_date = now()::timestamp
           , modify_user = @modifyUser
       where vessel_no = @vesselNo
         and material_code = @materialCode;`;

      let params: NamedParam[] = [
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
                  , @initialStock as receive_qty
                  , 'S0' as receive_type
                  , @registUser as regist_user
                  , @modifyUser as modify_user
               from material as a1
              where a1.vessel_no = @vesselNo
                and a1.material_code = @materialCode) as b
         on (a.vessel_no = b.vessel_no
             and a.material_code = b.material_code
             and a.receive_type = b.receive_type)
       when matched then
            update
               set receive_unit = b.receive_unit
                 , receive_qty = b.receive_qty
                 , modify_date = now()::timestamp
                 , modify_user = b.modify_user
       when not matched then
            insert (vessel_no
                  , receive_no
                  , material_code
                  , receive_unit
                  , receive_type
                  , receive_qty
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
                  , now()::timestamp
                  , b.regist_user);`;

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
