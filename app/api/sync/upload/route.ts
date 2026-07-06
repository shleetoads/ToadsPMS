import { NextResponse } from 'next/server';
import { verifyNode, findForeignVesselTable } from '@/lib/sync/nodeAuth';

// 엣지 → 중앙 업로드 수신 (upload-only + 양방향 마스터)
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.3, §11
//
// [P0] 노드 토큰 게이트웨이 + vessel 소유권 강제까지 구현.
// [P1] change_seq 커서 기반 ON CONFLICT 멱등 upsert + set_config('app.sync_apply','on') 은 후속.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // 1) 노드 인증 (미인증/정지/vessel 불일치 → 401/403)
  const auth = await verifyNode(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  // 2) 페이로드 파싱
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  // 3) vessel 소유권 강제 — 타 선박 데이터 주입 차단(GAP-3/6)
  const foreign = findForeignVesselTable(body?.rows ?? {}, auth.node.vesselNo);
  if (foreign) {
    return NextResponse.json(
      { success: false, message: `Foreign vessel rows in table: ${foreign}` },
      { status: 403 }
    );
  }

  // 4) [P1] 델타 upsert 미구현 — 게이트웨이 통과만 확인 가능
  return NextResponse.json(
    { success: false, message: 'sync upload delta not implemented yet (P1)', stage: 'P0-gateway' },
    { status: 501 }
  );
}
