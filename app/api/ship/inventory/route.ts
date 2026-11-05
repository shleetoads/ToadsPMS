import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Machine } from '@/types/inventory/status/machine'; // ✅ interface import
import { Inventory } from '@/types/inventory/status/inventory'; // ✅ interface import

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: Inventory[] = await query(
      `select a.vessel_no
            , a.vessel_name
            , a.machine_name
            , a.material_code
            , a.material_name
            , coalesce(receive_qty, 0) - (coalesce(release_qty, 0) + coalesce(loss_qty, 0)) as stock_qty
            , a.standard_qty
         from (select a.vessel_no
                    , a.vessel_name
                    , b.machine_name
                    , b.material_code
                    , b.material_name
                    , coalesce(b.standard_qty, 0) as standard_qty
                    , (select sum(coalesce(receive_qty, 0))
                         from receive
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code
                          and coalesce(delete_yn, 'N') = 'N') as receive_qty
                    , (select sum(coalesce(release_qty, 0))
                         from "release"
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code) as release_qty
                    , (select sum(coalesce(loss_qty, 0))
                         from loss
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code) as loss_qty
                 from vessel as a
                 left outer join material as b
                   on a.vessel_no = b.vessel_no
                  and coalesce(b.delete_yn, 'N') = 'N'
                 left outer join machine as c
                   on b.vessel_no = c.vessel_no
                  and b.machine_name = c.machine_name
                 left outer join warehouse as d
                   on b.vessel_no = d.vessel_no
                  and b.warehouse_no = d.warehouse_no
                  and coalesce(d.delete_yn, 'N') = 'N'
                where a.vessel_no = @vesselNo
                  and a.use_yn = 'Y') as a
        where a.standard_qty > coalesce(receive_qty, 0) - (coalesce(release_qty, 0) + coalesce(loss_qty, 0))
        order by a.vessel_no
               , a.machine_name
               , a.material_code`,
    [
      { name: 'vesselNo', value: vesselNo }
    ]);

    let machines: Machine[] = [];
    let machine: Machine;

    let machineName: string = '';

    items.map(item => {
      if (machineName !== item.machine_name) {
        machine = {
          vessel_no: item.vessel_no,
          vessel_name: item.vessel_name,
          machine_name: item.machine_name,
          children: [] = []
        }

        machines.push(machine);
        machineName = item.machine_name;
      }
      
      if (item.material_code)
        machine.children.push(item);
    });

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(machines);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}