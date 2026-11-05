import { NextResponse } from 'next/server';
import { query, withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { Loss } from '@/types/inventory/loss/loss';

export async function POST(req: Request) {
  try {
    const remoteSiteUrl = process.env.REMOTE_SITE_URL;
    const body = await req.json();
    const items : Loss[] = body;

    const count = await withTransaction(async (client) => {
      let total = 0;
      for (const item of items) {
        const queryString = `
        insert into loss (
               vessel_no
             , loss_no
             , material_code
             , loss_date
             , loss_type
             , loss_unit
             , loss_qty
             , loss_location
             , loss_reason
             , regist_date
             , regist_user
        )
        values (
                @vesselNo
              , (select 'L0' || to_char(now(), 'YYMM') || lpad((coalesce(right(max(loss_no), 3)::int, 0) + 1)::text, 3, '0')
                   from loss
                  where vessel_no = @vesselNo)
              , @materialCode
              , @lossDate
              , 'L0'
              , @lossUnit
              , @lossQty
              , @lossLocation
              , @lossReason
              , now()::timestamp
              , @registUser
        );`;

        const params: NamedParam[] = [
          { name: 'vesselNo', value: item.vessel_no },
          { name: 'materialCode', value: item.material_code },
          { name: 'lossDate', value: item.loss_date },
          { name: 'lossUnit', value: item.loss_unit },
          { name: 'lossQty', value: item.loss_qty },
          { name: 'lossLocation', value: item.loss_location },
          { name: 'lossReason', value: item.loss_reason },
          { name: 'registUser', value: item.regist_user },
          { name: 'modifyUser', value: item.modify_user },
        ];

        const { text, values } = adaptNamedParams(queryString, params);
        const result = await client.query(text, values);
        total += result.rowCount ?? 0;
      }
      return total;
    });

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
    }

    // 저장된 정비 정보 조회
    const sendData: Loss[] = await query(
      `select vessel_no
            , loss_no
            , material_code
            , loss_date
            , loss_type
            , loss_unit
            , loss_qty
            , loss_location
            , loss_reason
            , regist_date
            , regist_user
         from loss
        where vessel_no = @vesselNo
          and regist_user = @registUser
          and regist_date >= current_date;`,
      [
        { name: 'vesselNo', value: items[0].vessel_no },
        { name: 'registUser', value: items[0].regist_user },
      ]
    );

    // 선박에서 저장된 정비 정보 전송
    // 베스트에포트 레거시 전송: 주기적 동기화 엔진이 본 경로를 대체하므로, 전송 실패/지연이
    // 이미 커밋된 저장(응답)에 절대 영향을 주지 않도록 한다. remoteSiteUrl 미설정 시 건너뜀.
    if (remoteSiteUrl && sendData[0]) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const fetchResponse = await fetch(`${remoteSiteUrl}/api/data/inventory/loss/sets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sendData),
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (fetchResponse.ok) {
          // 정비 정보의 마지막 전송일자 수정
          await withTransaction(async (client) => {
            for (const item of sendData) {
              const queryString =
                `update loss
                    set last_send_date = now()::timestamp
                  where vessel_no = @vesselNo
                    and loss_no = @lossNo;`

              const params: NamedParam[] = [
                { name: 'vesselNo', value: item.vessel_no },
                { name: 'lossNo', value: item.loss_no },
              ];

              const { text, values } = adaptNamedParams(queryString, params);
              await client.query(text, values);
            }
          });
        }
      } catch (err) {
        console.error('[forward] loss forward failed:', (err as Error).message);
      }
    }
    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
