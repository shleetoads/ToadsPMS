import { NextResponse } from 'next/server';
import { query, execute, withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { Material } from '@/types/inventory/material/material';

export async function POST(req: Request) {
  try {
    const remoteSiteUrl = process.env.REMOTE_SITE_URL;
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
                  , (select b.receive_type || to_char(now(), 'YYMM') || lpad((coalesce(right(max(receive_no), 3)::int, 0) + 1)::text, 3, '0')
                       from receive
                      where vessel_no = b.vessel_no
                        and receive_type = b.receive_type)
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
           and material_code = @materialCode;`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'materialCode', value: item.material_code },
      ]
    );

    // 선박에서 저장된 자재 정보 전송
    if (sendData[0]) {
      fetch(`${remoteSiteUrl}/api/data/inventory/material/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendData[0]),
      })
      .then(res => {
        if (res.ok) {
          // 자재 정보의 마지막 전송일자 수정
          execute(
            `update material
                set last_send_date = now()::timestamp
              where vessel_no = @vesselNo
                and warehouse_no = @materialCode;`,
            [
              { name: 'vesselNo', value: sendData[0].vessel_no },
              { name: 'materialCode', value: sendData[0].material_code },
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
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
