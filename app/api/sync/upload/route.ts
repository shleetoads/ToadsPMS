import { NextResponse } from 'next/server';
import { withTransaction } from '@/db';
import { verifyNode, findForeignVesselTable } from '@/lib/sync/nodeAuth';
import { upsertRows, UPLOAD_TABLE_MAP } from '@/lib/sync/upsert';

// 엣지 → 중앙 업로드 수신.
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.3, §11
// 노드 토큰 인증 + vessel 소유권 강제 + ON CONFLICT 멱등 apply + 에코 차단.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // 1) 노드 인증
  const auth = await verifyNode(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  // 2) 파싱
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }
  const rowsByTable: Record<string, any[]> = body?.rows ?? {};

  // 3) vessel 소유권 강제 — 타 선박 주입 차단(GAP-3/6)
  const foreign = findForeignVesselTable(rowsByTable, auth.node.vesselNo);
  if (foreign) {
    return NextResponse.json(
      { success: false, message: `Foreign vessel rows in table: ${foreign}` }, { status: 403 }
    );
  }

  // 4) 멱등 apply (에코 차단)
  try {
    const counts: Record<string, number> = {};
    await withTransaction(async (client) => {
      await client.query("SET LOCAL app.sync_apply = 'on'");
      for (const { table, pk } of UPLOAD_TABLE_MAP) {
        const rows = (rowsByTable[table] ?? []).map((r) => {
          const { change_seq, ...rest } = r; // 발신자 seq 제거(수신측 자기 시퀀스)
          return rest;
        });
        counts[table] = await upsertRows(client, table, pk, rows, false);
      }
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return NextResponse.json({ success: true, total, counts });
  } catch (err) {
    console.error('[sync/upload]', err);
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 });
  }
}
