import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Material } from '@/types/inventory/material/material';
import { Machine } from '@/types/inventory/material/machine';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

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
         from vessel as a
         left outer join material as b
           on a.vessel_no = b.vessel_no
         left outer join machine as c
           on b.vessel_no = c.vessel_no
          and b.machine_name = c.machine_name
         left outer join receive as d
           on b.vessel_no = d.vessel_no
          and b.material_code = d.material_code
          and d.receive_type = 'S0'
         left outer join warehouse as e
           on b.vessel_no = e.vessel_no
          and b.warehouse_no = e.warehouse_no
        where a.vessel_no = @vesselNo
          and a.use_yn = 'Y'
        order by a.vessel_no, coalesce(c.sort_no, 999), b.machine_name, b.material_code;`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    let machines: Machine[] = []
    let machine: Machine

    let machineName: string = '';

    items.map(item => {
      if (machineName !== item.machine_name) {
        machine = {
          vessel_no: item.vessel_no,
          vessel_name: item.vessel_name,
          machine_name: item.machine_name,
          children: []
        }

        machines.push(machine);
        machineName = item.machine_name;
      }
      
      if (item.material_code) {
        machine.children.push(item)
      }
    });

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(machines);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}