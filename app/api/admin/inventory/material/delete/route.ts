import { NextResponse } from 'next/server';
import { query, withTransaction, NamedParam, executeWithClient } from '@/db';
import { Material } from '@/types/inventory/material/material';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item : Material = body;

    // 호출 페이지는 material_code 값을 material_no 키로 전송하므로 둘 다 수용.
    const materialCode = (body.material_no ?? item.material_code) as string;

    const baseParams: NamedParam[] = [
      { name: 'vesselNo', value: item.vessel_no },
      { name: 'materialCode', value: materialCode },
    ];

    // 출고(release)/손망실(loss) 이력이 있으면 삭제 불가(FK 보호). 아무것도 변경하지 않는다.
    const usage = await query<{ cnt: number }>(
      `select (select count(1)
                 from "release"
                where vessel_no = @vesselNo
                  and material_code = @materialCode)
            + (select count(1)
                 from loss
                where vessel_no = @vesselNo
                  and material_code = @materialCode) as cnt;`,
      baseParams,
    );

    if (Number(usage[0]?.cnt ?? 0) > 0) {
      return NextResponse.json(
        { success: false, message: '사용(출고/손망실) 이력이 있는 부품은 삭제할 수 없습니다.' },
        { status: 409 },
      );
    }

    // modify_user는 요청에 사용자 정보가 있을 때만 반영.
    let modifyUserSet = '';
    const extraParams: NamedParam[] = [];
    if (item.modify_user !== undefined && item.modify_user !== null && String(item.modify_user) !== '') {
      modifyUserSet = `
            , modify_user = @modifyUser`;
      extraParams.push({ name: 'modifyUser', value: item.modify_user });
    }
    const params: NamedParam[] = [...baseParams, ...extraParams];

    // 실제 삭제 대신 소프트 삭제: 자재와 해당 S0(기초재고) 입고 행을 숨김 처리(데이터 보존, 동기화로 전파).
    const count = await withTransaction(async (client) => {
      let total = 0;

      total += await executeWithClient(
        client,
        `update receive
            set delete_yn = 'Y'
              , modify_date = now()::timestamp${modifyUserSet}
          where vessel_no = @vesselNo
            and material_code = @materialCode
            and receive_type = 'S0'
            and coalesce(delete_yn, 'N') = 'N';`,
        params,
      );

      total += await executeWithClient(
        client,
        `update material
            set delete_yn = 'Y'
              , modify_date = now()::timestamp${modifyUserSet}
          where vessel_no = @vesselNo
            and material_code = @materialCode
            and coalesce(delete_yn, 'N') = 'N';`,
        params,
      );

      return total;
    });

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not deleted.' }, { status: 401 });
    }

    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
