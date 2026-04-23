import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { Vessel } from '@/types/vessel/vessel';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item: Vessel = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `merge vessel as a
       using (select @vesselNo as vessel_no
                   , @vesselName as vessel_name
                   , @vesselShortName as vessel_short_name
                   , @imoNo as imo_no
                   , @useYn as use_yn
                   , @registUser as regist_user
                   , @modifyUser as modify_user) as b
          on (a.vessel_no = b.vessel_no)
        when matched then
             update
                set vessel_name = b.vessel_name
                  , vessel_short_name = b.vessel_short_name
                  , imo_no = b.imo_no
                  , use_yn = b.use_yn
                  , modify_date = now()::timestamp
                  , modify_user = b.modify_user
        when not matched then
             insert (vessel_no
                   , vessel_name
                   , vessel_short_name
                   , imo_no
                   , use_yn
                   , regist_date
                   , regist_user)
             values (b.vessel_no
                   , b.vessel_name
                   , b.vessel_short_name
                   , b.imo_no
                   , b.use_yn
                   , now()::timestamp
                   , b.regist_user);`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'vesselName', value: item.vessel_name },
        { name: 'vesselShortName', value: item.vessel_short_name },
        { name: 'imoNo', value: item.imo_no },
        { name: 'useYn', value: item.use_yn },
        { name: 'registUser', value: item.regist_user },
        { name: 'modifyUser', value: item.modify_user },
      ]
    );

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not saved.' }, { status: 401 });
    }

    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}