import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Position } from '@/types/position'; // ✅ interface import

export async function GET(req: Request) {
  try {
    // DB에서 사용자 정보 확인
    const items: Position[] = await query(
      `select pos_no, pos_code, pos_name, pos_ename, pos_part, use_yn
         from position
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