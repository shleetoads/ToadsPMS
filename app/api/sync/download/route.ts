import { NextResponse } from 'next/server';
import { verifyNode } from '@/lib/sync/nodeAuth';

// 중앙 → 엣지 다운로드 (download-only + 양방향 마스터), vessel 1척 스코프
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.3, §11
//
// [P0] 노드 토큰 게이트웨이 + vessel 스코프 강제까지 구현.
// [P1] WHERE vessel_no=:v AND change_seq>cursor 델타 조회 (user는 ship_no=:v),
//      커서는 수신 행 max(change_seq)로 전진(V2) 은 후속.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // 1) 노드 인증
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

  // 3) 요청 vessel 스코프 강제 — 노드는 자기 선박만 조회 가능
  if (body?.vessel_no !== undefined && body.vessel_no !== auth.node.vesselNo) {
    return NextResponse.json(
      { success: false, message: 'Vessel scope mismatch' },
      { status: 403 }
    );
  }

  // 4) [P1] 델타 조회 미구현 — 게이트웨이 통과만 확인 가능
  return NextResponse.json(
    { success: false, message: 'sync download delta not implemented yet (P1)', stage: 'P0-gateway' },
    { status: 501 }
  );
}
