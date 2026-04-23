import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Warehouse } from '@/types/inventory/warehouse/warehouse';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: Warehouse[] = await query(
      `select a.vessel_no
            , b.vessel_name
            , a.warehouse_no
            , a.warehouse_name
            , a.warehouse_location
            , a.warehouse_desc
            , a.use_yn
            , (select count(1) as cnt
                 from release
                where vessel_no = a.vessel_no
                  and release_location = a.warehouse_no) as releasing_count
            , (select count(1)
                 from receive
                where vessel_no = a.vessel_no
                  and receive_location = a.warehouse_no) as receiving_count
             , to_char(a.regist_date, 'YYYY-MM-DD') as regist_date
             , to_char(a.modify_date, 'YYYY-MM-DD') as modify_date
          from warehouse as a
        inner join vessel as b
            on a.vessel_no = b.vessel_no
        where a.vessel_no = @vesselNo
          and a.use_yn = 'Y';`,
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