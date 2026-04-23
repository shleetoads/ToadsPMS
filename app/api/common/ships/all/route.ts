import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Vessel } from '@/types/vessel/vessel';

export async function GET(req: Request) {
  try {
    // DB에서 사용자 정보 확인
    const items: Vessel[] = await query(
      `select vessel_no, vessel_name, imo_no, vessel_short_name, use_yn 
         from vessel
        where use_yn = 'Y'`
    );

    if (items.length === 0) {
      return NextResponse.json({ success: false, message: 'The data does not exist.' }, { status: 401 });
    }

    // 성공 시 선박 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}