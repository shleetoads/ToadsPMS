import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Vessel } from '@/types/vessel/vessel';

export async function GET(req: Request) {
  try {
    // DB에서 데쉬보드 정보 확인
    const items: Vessel[] = await query(
      `select a.vessel_no
            , a.vessel_name
            , a.vessel_short_name
            , a.imo_no
            , a.use_yn
            , (select count(1) from equipment where vessel_no = a.vessel_no) as machine_count
            , (select count(1) from maintenance_plan where vessel_no = a.vessel_no) as maintenance_count
            , (select count(1) from "user" where ship_no = a.vessel_no) as crew
         from vessel as a
        where a.use_yn = 'Y'
          and exists (select 1
                        from maintenance_extension as b
                       where b.vessel_no = a.vessel_no)`
    );

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}