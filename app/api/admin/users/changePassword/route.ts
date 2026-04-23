import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      account_no,
      password
    } = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `update "user"
          set password = convert(varbinary(MAX), @password)
        where account_no = @accountNo;`,
      [
        { name: 'accountNo', value: account_no },
        { name: 'password', value: password },
      ]
    );

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not updated.' }, { status: 401 });
    }

    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}