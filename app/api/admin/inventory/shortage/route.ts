import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Inventory } from '@/types/inventory/status/inventory'; // ✅ interface import

export async function GET(req: Request) {
  try {
    // DB에서 데쉬보드 정보 확인
    const items: Inventory[] = await query(
      `select a.vessel_no
            , a.vessel_name
            , a.machine_name
            , a.material_code
            , a.material_name
            , a.material_unit
            , a.standard_qty
            , a.receive_qty - (a.release_qty + a.loss_qty) as stock_qty
            , a.standard_qty - (a.receive_qty - (a.release_qty + a.loss_qty)) as shortage_qty
            , coalesce(to_char(a.last_used, 'YYYY-MM-DD'), '') as last_used
         from (select a.vessel_no
                    , a.vessel_name
                    , b.machine_name
                    , c.sort_no
                    , b.material_code
                    , b.material_name
                    , b.material_unit
                    , coalesce(b.standard_qty, 0) as standard_qty
                    , (select sum(coalesce(receive_qty, 0))
                         from receive
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code) as receive_qty
                    , (select sum(coalesce(release_qty, 0))
                         from "release"
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code) as release_qty
                    , (select sum(coalesce(loss_qty, 0))
                         from loss
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code) as loss_qty
                    , (select max(release_date)
                         from "release"
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code) as last_used
                 from vessel as a
                 left outer join material as b
                   on a.vessel_no = b.vessel_no
                 left outer join machine as c
                   on b.vessel_no = c.vessel_no
                  and b.machine_name = c.machine_name
                 left outer join warehouse as d
                   on b.vessel_no = d.vessel_no
                  and b.warehouse_no = d.warehouse_no
                where a.use_yn = 'Y') as a
        where a.standard_qty > a.receive_qty - (a.release_qty + a.loss_qty)
        order by a.vessel_no
               , a.sort_no
               , a.material_code`);

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}