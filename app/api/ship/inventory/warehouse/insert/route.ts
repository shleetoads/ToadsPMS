import { NextResponse } from 'next/server';
import { execute, query } from '@/db'; // 이전에 만든 query 함수
import { Warehouse } from '@/types/inventory/warehouse/warehouse';

export async function POST(req: Request) {
  try {
    const remoteSiteUrl = process.env.REMOTE_SITE_URL;
    const body = await req.json();
    const item : Warehouse = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `insert into warehouse (
              vessel_no
            , warehouse_no
            , warehouse_name
            , warehouse_location
            , use_yn
            , regist_date
            , regist_user
      )
      values (
              @vesselNo
            , (select 'W' || lpad((coalesce(right(max(warehouse_no), 3)::int, 0) + 1)::text, 3, '0') 
                 from warehouse 
                where vessel_no = @vesselNo)
            , @warehouseName
            , @warehouseLocation
            , 'Y'
            , now()::timestamp
            , @registUser
      );`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'warehouseName', value: item.warehouse_name },
        { name: 'warehouseLocation', value: item.warehouse_location },
        { name: 'registUser', value: item.regist_user }
      ]
    );

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
    }
        
    // 저장된 창고 정보 조회
    const sendData: Warehouse[] = await query(
      `select vessel_no
            , warehouse_no
            , warehouse_name
            , warehouse_location
            , use_yn
            , regist_date
            , regist_user
         from warehouse
        where vessel_no = @vesselNo
          and warehouse_no = (select max(warehouse_no)
                                from warehouse
                               where vessel_no = @vesselNo
                                 and regist_user = @registUser)
          and coalesce(delete_yn, 'N') = 'N';`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'registUser', value: item.regist_user },
      ]
    );
    
    // 선박에서 저장된 창고 정보 전송
    // 베스트에포트 레거시 전송: 주기적 동기화 엔진이 본 경로를 대체하므로, 전송 실패/지연이
    // 이미 커밋된 저장(응답)에 절대 영향을 주지 않도록 한다. remoteSiteUrl 미설정 시 건너뜀.
    if (remoteSiteUrl && sendData[0]) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const fetchResponse = await fetch(`${remoteSiteUrl}/api/data/inventory/warehouse/set`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sendData[0]),
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (fetchResponse.ok) {
          // 창고 정보의 마지막 전송일자 수정
          await execute(
            `update warehouse
                set last_send_date = now()::timestamp
              where vessel_no = @vesselNo
                and warehouse_no = @warehouseNo;`,
            [
              { name: 'vesselNo', value: sendData[0].vessel_no },
              { name: 'warehouseNo', value: sendData[0].warehouse_no },
            ]
          );
        }
      } catch (err) {
        console.error('[forward] warehouse forward failed:', (err as Error).message);
      }
    }

    // 성공 정보 반환
    return NextResponse.json({ success: true, data: sendData[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}