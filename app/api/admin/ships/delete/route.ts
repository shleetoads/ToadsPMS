import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { Vessel } from '@/types/vessel/vessel';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item: Vessel = body;

    // DB에서 사용자 정보 확인
    const count = await execute(
      `delete from [vessel]
        where vessel_no = @vesselNo;`,
      [
        { name: 'vesselNo', value: item.vessel_no },
      ]
    );

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