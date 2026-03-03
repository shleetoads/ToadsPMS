import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Machine } from '@/types/vessel/machine';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vesselNo = searchParams.get('vesselNo');

  try {
    // DB에서 데쉬보드 정보 확인
    const items: Machine[] = await query(
      `select a.vessel_no
            , a.machine_name
         from [machine] as a
        where exists (select 1
                        from [equipment] as b
                       inner join [maintenance_extension] as c
                          on b.vessel_no = c.vessel_no
                         and b.equip_no = c.equip_no
                       where b.vessel_no = a.vessel_no
                         and b.machine_name = a.machine_name)
          and a.vessel_no = @vesselNo
        order by a.sort_no`,
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