import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Equipment } from '@/types/common/equipment';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: Equipment[] = await query(
      `select vessel_no
            , equip_no
            , equip_name
            , machine_name
         from equipment
        where vessel_no = @vesselNo`,
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