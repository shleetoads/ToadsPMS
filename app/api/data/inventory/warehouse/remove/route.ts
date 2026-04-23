import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { Warehouse } from '@/types/inventory/warehouse/warehouse';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item : Warehouse = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `delete from warehouse
        where vessel_no = @vesselNo
          and warehouse_no = @warehouseNo;`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'warehouseNo', value: item.warehouse_no },
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