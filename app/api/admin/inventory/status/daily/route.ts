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
            , to_char(now()::timestamp, 'YYYY-MM-DD') as period
            , coalesce(a.receive_qty, 0) as receive_qty
            , coalesce(a.release_qty, 0) as release_qty
            , coalesce(a.loss_qty, 0) as loss_qty
            , coalesce(a.total_receive_qty, 0) - (coalesce(a.total_release_qty, 0) + coalesce(a.total_loss_qty, 0)) as stock_qty
         from (select a.vessel_no
                    , a.vessel_name
                    , b.machine_name
                    , coalesce(c.sort_no, 999) as sort_no
                    , b.material_code
                    , b.material_name
                    , b.material_unit
                    , coalesce(b.standard_qty, 0) as standard_qty
                    , (select sum(coalesce(receive_qty, 0))
                         from receive
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code
                          and receive_date = to_char(now()::timestamp, 'YYYY-MM-DD')) as receive_qty
                    , (select sum(coalesce(release_qty, 0))
                         from "release"
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code
                          and release_date = to_char(now()::timestamp, 'YYYY-MM-DD')) as release_qty
                    , (select sum(coalesce(loss_qty, 0))
                         from loss
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code
                          and loss_date = to_char(now()::timestamp, 'YYYY-MM-DD')) as loss_qty
                    , (select sum(coalesce(receive_qty, 0))
                         from receive
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code) as total_receive_qty
                    , (select sum(coalesce(release_qty, 0))
                         from "release"
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code) as total_release_qty
                    , (select sum(coalesce(loss_qty, 0))
                         from loss
                        where vessel_no = b.vessel_no
                          and material_code = b.material_code) as total_loss_qty
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
        order by a.vessel_no
               , a.sort_no
               , a.machine_name
               , a.material_code`);

    let vessels: Inventory[] = [];
    let vessel: Inventory;
    let machine: Inventory;

    let vesselNo: string = '';
    let machineName: string = '';

    items.map(item => {
      if (vesselNo !== item.vessel_no) {
        vessel = {
          id: item.vessel_no,
          name: item.vessel_name,
          vessel_no: item.vessel_no,
          vessel_name: item.vessel_name,
          type: "VESSEL",
          key: item.vessel_no || '',
          children: [] = []
        }

        vessels.push(vessel);
        vesselNo = item.vessel_no;
        machineName = '';
      }

      if (item.machine_name && machineName !== item.machine_name) {
        machine = {
          id: item.machine_name || '',
          name: item.machine_name || '',
          vessel_no: item.vessel_no,
          vessel_name: item.vessel_name,
          machine_name: item.machine_name,
          type: "MACHINE",
          key: `${item.vessel_no}-${item.machine_name}` || '',
          children: [] = []
        }

        vessel.children.push(machine);
        machineName = item.machine_name || '';
      }
      
      if (item.material_code) {
        item = {...item, 
          id: item.material_code || '',
          name: item.material_name || '',
          type: "MATERIAL",
          key:  `${item.vessel_no}-${item.machine_name}-${item.material_code}` || '',
        }

        machine.children.push(item);
      }
    });

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(vessels);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}