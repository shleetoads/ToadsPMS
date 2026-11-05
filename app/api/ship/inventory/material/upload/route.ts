import { NextResponse } from 'next/server';
import { query, withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { Material } from '@/types/inventory/material/material';

export async function POST(req: Request) {
  const remoteSiteUrl = process.env.REMOTE_SITE_URL;
  const body = await req.json();
  const {vesselNo, registUser, modifyUser, excelData} = body;

  if (!Array.isArray(excelData) || excelData.length === 0) {
    return NextResponse.json({ success: false, message: 'There is no valid data.' }, { status: 400 });
  }

  try {
    const count = await withTransaction(async (client) => {
      let total = 0;

      for (const rows of excelData) {
        if (vesselNo !== rows.CallSign) {
          continue;
        }

        let queryString =
        `merge material as a
          using (select @vesselNo as vessel_no
                      , @materialName as material_name
                      , @materialGroup as material_group
                      , public.fn_get_material_type(@materialType) as material_type
                      , public.fn_get_material_unit(@materialUnit) as material_unit
                      , public.fn_get_warehouse_no(@warehouseName) as warehouse_no
                      , @drawingNo as drawing_no
                      , @machineName as machine_name
                      , @standardQty as standard_qty
                      , @registUser as regist_user
                      , @modifyUser as modify_user ) as b
            on (a.vessel_no = b.vessel_no
            and a.machine_name = b.machine_name
            and a.material_name = b.material_name)
          when matched then
                update
                  set material_name = b.material_name
                    , material_group = b.material_group
                    , material_type = b.material_type
                    , material_unit = b.material_unit
                    , warehouse_no = b.warehouse_no
                    , drawing_no = b.drawing_no
                    , machine_name = b.machine_name
                    , standard_qty = b.standard_qty
                    , modify_date = now()::timestamp
                    , modify_user = b.modify_user
          when not matched then
                insert (
                      vessel_no
                    , material_code
                    , material_name
                    , material_group
                    , material_type
                    , material_unit
                    , warehouse_no
                    , drawing_no
                    , machine_name
                    , standard_qty
                    , regist_date
                    , regist_user
              )
              values (
                      b.vessel_no
                    , (select b.material_type || to_char(now(), 'YYMM') || lpad((coalesce(right(max(material_code), 3)::int, 0) + 1)::text, 3, '0')
                         from material
                        where vessel_no = b.vessel_no
                          and material_type = b.material_type
                          and material_type like b.material_type || to_char(now(), 'YYMM') || '%')
                    , b.material_name
                    , b.material_group
                    , b.material_type
                    , b.material_unit
                    , b.warehouse_no
                    , b.drawing_no
                    , b.machine_name
                    , b.standard_qty
                    , now()::timestamp
                    , b.regist_user
              );`

        let params: NamedParam[] = [
          { name: 'vesselNo', value: vesselNo },
          { name: 'materialName', value: rows.MaterialName ? rows.MaterialName : '' },
          { name: 'materialGroup', value: rows.MaterialGroup ? rows.MaterialGroup : '' },
          { name: 'materialType', value: rows.Type ? rows.Type : '' },
          { name: 'materialUnit', value: rows.Unit ? rows.Unit : '' },
          { name: 'warehouseName', value: rows.Warehouse ? rows.Warehouse : '' },
          { name: 'drawingNo', value: rows.DrawingNo ? rows.DrawingNo : '' },
          { name: 'machineName', value: rows.Machine ? rows.Machine : '' },
          { name: 'standardQty', value: rows.StandardQty ? rows.StandardQty : '0' },
          { name: 'initialStock', value: rows.InitialStock ? rows.InitialStock : '0' },
          { name: 'registUser', value: registUser },
          { name: 'modifyUser', value: modifyUser },
        ];

        let { text, values } = adaptNamedParams(queryString, params);
        let result = await client.query(text, values);

        total += result.rowCount ?? 0;

        if (rows.InitialStock && Number.parseInt(rows.InitialStock) > 0) {
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
                    and a1.machine_name = @machineName
                    and a1.material_code = (select max(material_code)
                                              from material
                                            where vessel_no = @vesselNo
                                              and machine_name = @machineName
                                              and material_name = @materialName
                                              and regist_user = @registUser)) as b
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
        }
      }

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
          and regist_user = @registUser
          and to_char(regist_date, 'YYYY-MM-DD') = to_char(now()::timestamp, 'YYYY-MM-DD')
          and coalesce(delete_yn, 'N') = 'N';`,
      [
        { name: 'vesselNo', value: vesselNo },
        { name: 'registUser', value: registUser },
      ]
    );

    // 선박에서 저장된 자재 정보 전송
    // NOTE: 원본의 try/catch 내 `async () => { ... }` 블록은 호출되지 않아 동작하지 않았음 (기존 버그 보존).
    if (sendData) {
      fetch(`${remoteSiteUrl}/api/data/inventory/material/sets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendData),
      })
      .then(res => {
        if (res.ok) {
          try {
            async () => {
              await withTransaction(async (client) => {
                for (const material of sendData) {
                  // 자재 정보의 마지막 전송일자 수정
                  const queryString =
                    `update material
                        set last_send_date = now()::timestamp
                      where vessel_no = @vesselNo
                        and material_code = @materialCode;`

                  const params: NamedParam[] = [
                    { name: 'vesselNo', value: material.vessel_no },
                    { name: 'materialCode', value: material.material_code },
                  ]

                  const { text, values } = adaptNamedParams(queryString, params);
                  await client.query(text, values);
                }
              });
            }
          } catch (err) {
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
