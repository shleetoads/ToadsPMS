import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { User } from '@/types/user';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item: User = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `update "user"
          set user_name = @userName
            , user_ename = @userEname
            , email = @email
            , position = @position
            , ship_no = @shipNo
            , user_auth = @userAuth
            , use_yn = @useYn
            , modify_date = now()::timestamp
            , modify_user = @modifyUser
        where account_no = @accountNo;`,
      [
        { name: 'accountNo', value: item.account_no },
        { name: 'userName', value: item.user_name },
        { name: 'userEname', value: item.user_ename },
        { name: 'email', value: item.email },
        { name: 'position', value: item.position },
        { name: 'shipNo', value: item.ship_no },
        { name: 'userAuth', value: item.user_auth },
        { name: 'useYn', value: item.use_yn },
        { name: 'modifyUser', value: item.modify_user },
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