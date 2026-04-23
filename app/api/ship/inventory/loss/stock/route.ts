import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Stock } from '@/types/inventory/loss/stock';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: Stock[] = await query(
      `select a.vessel_no
            , a.vessel_name
            , b.machine_name
            , b.material_code
            , b.material_name
            , b.material_unit
            , coalesce(d.location, '') as location
            , coalesce(e.warehouse_name, '') as location_name
            , d.stock_qty
         from vessel as a
         left outer join material as b
           on a.vessel_no = b.vessel_no
         left outer join (select a1.vessel_no
                               , a1.material_code
                               , a1.location
                               , sum(case when a1.type in ('S0', 'I0', 'AI') then a1.qty else 0 end) - sum(case when a1.type in ('L0', 'O0', 'AO') then a1.qty else 0 end) as stock_qty
                            from (select vessel_no
                                       , material_code
                                       , receive_type as type
                                       , coalesce(receive_location, '') as location
                                       , receive_qty as qty
                                    from receive
                                   where vessel_no = @vesselNo
                                  union all
                                  select vessel_no
                                       , material_code
                                       , release_type
                                       , coalesce(release_location, '')
                                       , release_qty as receive_qty
                                    from "release"
                                   where vessel_no = @vesselNo
                                  union all
                                  select vessel_no
                                       , material_code
                                       , loss_type
                                       , coalesce(loss_location, '')
                                       , loss_qty as receive_qty
                                    from loss
                                   where vessel_no = @vesselNo) as a1
                           group by a1.vessel_no
                                  , a1.material_code
                                  , a1.location) as d
           on b.vessel_no = d.vessel_no
          and b.material_code = d.material_code
		     left outer join warehouse as e
		       on d.vessel_no = e.vessel_no
		      and d.location = e.warehouse_no
        where a.vessel_no = @vesselNo
          and a.use_yn = 'Y'
          and d.stock_qty > 0;`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}