import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { Warehouse } from '@/types/inventory/warehouse/warehouse';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item : Warehouse = body;

    // 실제 삭제 대신 소프트 삭제: delete_yn='Y'로 숨김 처리(데이터는 보존).
    const params = [
      { name: 'vesselNo', value: item.vessel_no },
      { name: 'warehouseNo', value: item.warehouse_no },
    ];
    let modifyUserSet = '';
    if (item.modify_user !== undefined && item.modify_user !== null && String(item.modify_user) !== '') {
      modifyUserSet = `
            , modify_user = @modifyUser`;
      params.push({ name: 'modifyUser', value: item.modify_user });
    }

    // DB에서 사용자 정보 확인
    const count = await execute(
      `update warehouse
          set delete_yn = 'Y'
            , modify_date = now()::timestamp${modifyUserSet}
        where vessel_no = @vesselNo
          and warehouse_no = @warehouseNo
          and coalesce(delete_yn, 'N') = 'N';`,
      params
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