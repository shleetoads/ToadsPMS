import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { User } from '@/types/user';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, user_auth } = body;

    // DB에서 사용자 정보 확인
    const items: User[] = await query(
      `select a.account_no
            , a.user_name
            , a.user_ename
            , a.email
            , a.use_yn
            , a.ship_no
            , b.vessel_name as ship_name
            , a.position
            , a.user_auth 
         from "user" as a
         left outer join vessel as b
           on a.ship_no = b.vessel_no
        where email = @email
          and password = @password::bytea`,
      [
        { name: 'email', value: email },
        { name: 'password', value: password }
      ]
    );

    if (items.length === 0) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    // 성공 시 사용자 정보 반환
    return NextResponse.json({ success: true, user: items[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}