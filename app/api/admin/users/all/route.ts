import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { User } from '@/types/user';

export async function GET(req: Request) {
  try {
    // DB에서 사용자 정보 확인
    const items: User[] = await query(
      `select account_no, user_name, user_ename, email, use_yn, ship_no, position, user_auth 
         from "user"`
    );

    if (items.length === 0) {
      return NextResponse.json({ success: false, message: 'The data does not exist.' }, { status: 401 });
    }

    // 성공 시 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}