import { NextResponse } from 'next/server';
import { execute, query } from '@/db'; // 이전에 만든 query 함수
import { Adjustment } from '@/types/inventory/adjustment/adjustment';

export async function POST(req: Request) {
  try {
    const remoteSiteUrl = process.env.REMOTE_SITE_URL;
    const body = await req.json();
    const item : Adjustment = body;

    // DB에서 사용자 정보 확인
    if (item.adjustment_type === 'AI') {
      const count = await execute(
        `insert into receive (
                vessel_no
              , receive_no
              , material_code
              , receive_date
              , receive_type
              , receive_unit
              , receive_qty
              , receive_location
              , receive_reason
              , regist_date
              , regist_user
        )
        values (
                @vesselNo
              , (select @adjustmentType || to_char(now(), 'YYMM') || lpad((coalesce(right(max(receive_no), 3)::int, 0) + 1)::text, 3, '0')
                   from receive
                  where vessel_no = @vesselNo
                    and receive_type = @adjustmentType)
              , @materialCode
              , @adjustmentDate
              , @adjustmentType
              , @adjustmentUnit
              , @adjustmentQty
              , @adjustmentLocation
              , @adjustmentReason
              , now()::timestamp
              , @registUser
        );`,
        [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'materialCode', value: item.material_code },
          { name: 'adjustmentDate', value: item.adjustment_date },
          { name: 'adjustmentType', value: item.adjustment_type },
          { name: 'adjustmentUnit', value: item.adjustment_unit },
          { name: 'adjustmentQty', value: item.adjustment_qty },
          { name: 'adjustmentLocation', value: item.adjustment_location },
          { name: 'adjustmentReason', value: item.adjustment_reason },
          { name: 'registUser', value: item.regist_user }
        ]
      );

      if (count === 0) {
        return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
      }
          
      // 저장된 창고 정보 조회
      const sendData = await query(
        `select vessel_no
              , receive_no as adjustment_no
              , material_code
              , receive_date as adjustment_date
              , receive_type as adjustment_type
              , receive_unit as adjustment_unit
              , receive_qty as adjustment_qty
              , receive_location as adjustment_location
              , receive_reason as adjustment_reason
              , regist_date
              , regist_user
          from receive
          where vessel_no = @vesselNo
            and receive_no = (select max(receive_no)
                                from receive
                               where vessel_no = @vesselNo
                                 and receive_type = @adjustmentType
                                 and regist_user = @registUser)
            and coalesce(delete_yn, 'N') = 'N';`,
        [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'adjustmentDate', value: item.adjustment_date },
          { name: 'adjustmentType', value: item.adjustment_type },
          { name: 'registUser', value: item.regist_user },
        ]
      );

      // 선박에서 저장된 창고 정보 전송
      if (sendData[0]) {
        fetch(`${remoteSiteUrl}/api/data/inventory/adjustment/receive/set`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sendData[0]),
        })
        .then(res => {
          if (res.ok) {
            // 창고 정보의 마지막 전송일자 수정
            execute(
              `update "release"
                  set last_send_date = now()::timestamp
                where vessel_no = @vesselNo
                  and release_no = @adjustmentNo;`,
              [
                { name: 'vesselNo', value: sendData[0].vessel_no },
                { name: 'adjustmentNo', value: sendData[0].adjustment_no },
              ]
            );
          }

          return res.json();
        })
        .catch(err => {
          console.error('Error triggering cron job:', err);
        });
      }
    } else {
      const count = await execute(
        `insert into "release" (
                vessel_no
              , release_no
              , material_code
              , release_date
              , release_type
              , release_unit
              , release_qty
              , release_location
              , release_reason
              , regist_date
              , regist_user
        )
        values (
                @vesselNo
              , (select @adjustmentType || to_char(now(), 'YYMM') || lpad((coalesce(right(max(release_no), 3)::int, 0) + 1)::text, 3, '0')
                   from "release"
                  where vessel_no = @vesselNo
                    and release_type = @adjustmentType)
              , @materialCode
              , @adjustmentDate
              , @adjustmentType
              , @adjustmentUnit
              , @adjustmentQty
              , @adjustmentLocation
              , @adjustmentReason
              , now()::timestamp
              , @registUser
        );`,
        [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'materialCode', value: item.material_code },
          { name: 'adjustmentDate', value: item.adjustment_date },
          { name: 'adjustmentType', value: item.adjustment_type },
          { name: 'adjustmentUnit', value: item.adjustment_unit },
          { name: 'adjustmentQty', value: item.adjustment_qty },
          { name: 'adjustmentLocation', value: item.adjustment_location },
          { name: 'adjustmentReason', value: item.adjustment_reason },
          { name: 'registUser', value: item.regist_user }
        ]
      );

      if (count === 0) {
        return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
      }
          
      // 저장된 창고 정보 조회
      const sendData = await query(
        `select vessel_no
              , release_no as adjustment_no
              , material_code
              , release_date as adjustment_date
              , release_type as adjustment_type
              , release_unit as adjustment_unit
              , release_qty as adjustment_qty
              , release_location as adjustment_location
              , release_reason as adjustment_reason
              , regist_date
              , regist_user
           from "release"
          where vessel_no = @vesselNo
            and release_no = (select max(release_no)
                                from "release"
                               where vessel_no = @vesselNo
                                 and release_type = @adjustmentType
                                 and regist_user = @registUser);`,
        [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'adjustmentDate', value: item.adjustment_date },
          { name: 'adjustmentType', value: item.adjustment_type },
          { name: 'registUser', value: item.regist_user },
        ]
      );

      // 선박에서 저장된 창고 정보 전송
      if (sendData[0]) {
        fetch(`${remoteSiteUrl}/api/data/inventory/adjustment/release/set`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sendData[0]),
        })
        .then(res => {
          if (res.ok) {
            // 창고 정보의 마지막 전송일자 수정
            execute(
              `update "release"
                  set last_send_date = now()::timestamp
                where vessel_no = @vesselNo
                  and release_no = @adjustmentNo;`,
              [
                { name: 'vesselNo', value: sendData[0].vessel_no },
                { name: 'adjustmentNo', value: sendData[0].adjustment_no },
              ]
            );
          }
          
          return res.json();
        })
        .catch(err => {
          console.error('Error triggering cron job:', err);
        });
      }
    }
    

    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}