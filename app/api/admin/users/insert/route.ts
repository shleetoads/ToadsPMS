import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { User } from '@/types/user';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item: User = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `insert into "user" (
              account_no
            , user_name
            , user_ename
            , email
            , password
            , position
            , ship_no
            , user_auth
            , use_yn
            , regist_date
            , regist_user
       )
       values (
              (select coalesce(max(account_no), 10000) + 1 from "user")
            , @userName
            , @userEname
            , @email
            , convert(varbinary(MAX), @password)
            , @position
            , @shipNo
            , @userAuth
            , @useYn
            , now()::timestamp
            , @registUser
       );`,
      [
        { name: 'userName', value: item.user_name },
        { name: 'userEname', value: item.user_ename },
        { name: 'email', value: item.email },
        { name: 'password', value: item.password },
        { name: 'position', value: item.position },
        { name: 'shipNo', value: item.ship_no },
        { name: 'userAuth', value: item.user_auth },
        { name: 'useYn', value: item.use_yn },
        { name: 'registUser', value: item.regist_user },
      ]
    );

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
    }

    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}