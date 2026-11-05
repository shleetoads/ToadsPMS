import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Vessel } from '@/types/inventory/material/vessel'; // ✅ interface import
import { Material } from '@/types/inventory/material/material'; // ✅ interface import

export async function GET(req: Request) {
  try {
    // DB에서 데쉬보드 정보 확인
    const items: Material[] = await query(
      `select a.vessel_no
            , a.vessel_name
            , b.machine_name
            , b.material_code
            , b.material_name
            , b.material_group
            , b.material_spec
            , b.material_type
            , b.material_unit
            , b.drawing_no
            , b.warehouse_no
            , coalesce(e.warehouse_name, '') as warehouse_name
            , b.standard_qty
            , coalesce(d.receive_qty, 0) as initial_stock
            , (select sum(case receive_type when 'S0' then 0 else 1 end)
                 from receive
                where vessel_no = b.vessel_no
                  and material_code = b.material_code
                  and coalesce(delete_yn, 'N') = 'N') as receive_count
            , (select count(1)
                 from "release"
                where vessel_no = b.vessel_no
                  and material_code = b.material_code) as release_count
         from vessel as a
         left outer join material as b
           on a.vessel_no = b.vessel_no
          and coalesce(b.delete_yn, 'N') = 'N'
         left outer join machine as c
           on b.vessel_no = c.vessel_no
          and b.machine_name = c.machine_name
         left outer join receive as d
           on b.vessel_no = d.vessel_no
          and b.material_code = d.material_code
          and d.receive_type = 'S0'
          and coalesce(d.delete_yn, 'N') = 'N'
         left outer join warehouse as e
           on b.vessel_no = e.vessel_no
          and b.warehouse_no = e.warehouse_no
          and coalesce(e.delete_yn, 'N') = 'N'
        where a.use_yn = 'Y'
        order by a.vessel_no, coalesce(c.sort_no, 999), b.machine_name, b.material_code;`);

    let vessels: Vessel[] = [];
    let vessel: Vessel;

    let vesselNo: string = '';

    items.map(item => {
      if (vesselNo !== item.vessel_no) {
        vessel = {
          vessel_no: item.vessel_no,
          vessel_name: item.vessel_name,
          children: [] = []
        }

        vessels.push(vessel);
        vesselNo = item.vessel_no;
      }
      
      if (item.machine_name)
        vessel.children.push(item);
    });

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(vessels);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}