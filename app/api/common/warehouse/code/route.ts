import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Warehouse } from '@/types/common/warehouse'; // ✅ interface import

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const vesselNo = searchParams.get('vesselNo');

    // DB에서 데쉬보드 정보 확인
    const items: Warehouse[] = await query(
      `select vessel_no
            , warehouse_no
            , warehouse_name
            , warehouse_location
         from warehouse
        where vessel_no = @vesselNo
          and use_yn = 'Y'
          and coalesce(delete_yn, 'N') = 'N'`,
      [
        { name: 'vesselNo', value: vesselNo}
      ]);

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}