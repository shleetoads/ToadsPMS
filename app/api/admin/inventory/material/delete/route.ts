import { NextResponse } from 'next/server';
import { withTransaction, NamedParam, executeWithClient } from '@/db';
import { Material } from '@/types/inventory/material/material';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item : Material = body;

    const count = await withTransaction(async (client) => {
      let total = 0;

      const params: NamedParam[] = [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'materialCode', value: item.material_code },
      ];

      total += await executeWithClient(
        client,
        `delete from receive
          where vessel_no = @vesselNo
            and material_code = @materialCode
            and receive_type = 'S0';`,
        params,
      );

      total += await executeWithClient(
        client,
        `delete from material
          where vessel_no = @vesselNo
            and material_code = @materialCode;`,
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
