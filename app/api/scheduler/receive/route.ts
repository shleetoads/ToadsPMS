import { NextResponse } from 'next/server';
import { runReceive } from '@/lib/sync/receive';

// 중앙(REMOTE_SITE_URL) → 로컬 수신 (수동 트리거 엔드포인트).
// 실제 수신 로직은 lib/sync/receive.ts (회선 감지 감시자와 공용).
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.3
//
// 사용: GET /api/scheduler/receive              → 전체 재수신(since=1900-01-01)
//       GET /api/scheduler/receive?since=2026-06-01  → 증분 수신
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const remoteSiteUrl = process.env.REMOTE_SITE_URL;
  const vesselNo = process.env.VESSEL ?? '';
  const since = new URL(req.url).searchParams.get('since') || '1900-01-01';

  if (!remoteSiteUrl) {
    return NextResponse.json({ success: false, message: 'REMOTE_SITE_URL not set' }, { status: 400 });
  }
  if (!vesselNo) {
    return NextResponse.json({ success: false, message: 'VESSEL not set' }, { status: 400 });
  }

  try {
    const { total, counts } = await runReceive({ remoteSiteUrl, vesselNo, since });
    return NextResponse.json({ success: true, vessel_no: vesselNo, since, total, counts });
  } catch (err) {
    console.error('[scheduler/receive]', err);
    const msg = (err as Error).message || 'Server error';
    const status = msg.startsWith('remote get failed') ? 502 : 500;
    return NextResponse.json({ success: false, message: msg }, { status });
  }
}
