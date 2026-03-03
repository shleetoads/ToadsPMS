import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Equipment } from '@/types/vessel/equipment';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: Equipment[] = await query(
      `select a.vessel_no
            , a.equip_no
            , a.equip_name
            , a.machine_name
         from [equipment] as a
        where exists (select 1
                        from [maintenance_extension] as b
                       where b.vessel_no = a.vessel_no
                         and b.equip_no = a.equip_no)
          and a.vessel_no = @vesselNo`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(items);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}