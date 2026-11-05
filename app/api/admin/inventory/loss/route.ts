import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Loss } from '@/types/inventory/loss/loss'; // ✅ interface import

export async function GET(req: Request) {
  try {
    // DB에서 데쉬보드 정보 확인
    const items: Loss[] = await query(
      `select a.vessel_no
            , b.vessel_name
            , a.loss_no
            , c.machine_name
            , a.material_code
            , c.material_name
            , to_char(a.loss_date, 'YYYY-MM-DD') as loss_date
            , a.loss_unit
            , a.loss_qty
            , a.loss_location
            , a.loss_reason
            , a.loss_remark
            , public.fn_get_user(a.regist_user) as registrant
         from loss as a
        inner join vessel as b
           on a.vessel_no = b.vessel_no
        inner join material as c
           on a.vessel_no = c.vessel_no
          and a.material_code = c.material_code
          and coalesce(c.delete_yn, 'N') = 'N'
        order by a.vessel_no, a.loss_date`);

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}