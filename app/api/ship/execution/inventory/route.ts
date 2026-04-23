import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Inventory } from '@/types/vessel/inventory';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');
  const machineName = searchParams.get('machineName');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: Inventory[] = await query(
      `select a.vessel_no
            , a.vessel_name
            , b.machine_name
            , b.material_code
            , b.material_name
            , b.material_unit
            , b.warehouse_no
            , g.warehouse_name
            , coalesce(b.standard_qty, 0) as standard_qty
            , sum(coalesce(d.receive_qty, 0)) - sum(coalesce(e.release_qty, 0)) - sum(coalesce(f.loss_qty, 0)) as stock_qty
            , 0 use_qty
         from vessel as a
        inner join material as b
           on a.vessel_no = b.vessel_no
         left outer join receive as d
           on b.vessel_no = d.vessel_no
          and b.material_code = d.material_code
         left outer join "release" as e
           on b.vessel_no = e.vessel_no
          and b.material_code = e.material_code
         left outer join loss as f
           on b.vessel_no = f.vessel_no
          and b.material_code = f.material_code
         left outer join warehouse as g
           on b.vessel_no = g.vessel_no
          and b.warehouse_no = g.warehouse_no
        where a.vessel_no = @vesselNo
          and b.machine_name = @machineName
          and a.use_yn = 'Y'
        group by a.vessel_no
               , a.vessel_name
               , b.machine_name
               , b.material_code
               , b.material_name
               , b.material_unit
               , b.standard_qty
               , b.warehouse_no
               , g.warehouse_name
        order by a.vessel_no
               , b.machine_name
               , b.material_code`,
    [
      { name: 'vesselNo', value: vesselNo },
      { name: 'machineName', value: machineName },
    ]);

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}