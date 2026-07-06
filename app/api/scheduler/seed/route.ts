import { NextResponse } from 'next/server';
import { runSeed } from '@/lib/sync/seed';

// 엣지 온보딩 트리거 (최초 1회). 중앙에서 vessel 전체를 받아 로컬을 채운다.
// 설계: CENTRAL_REDEPLOY_PLAN §2.1
// 사용: GET /api/scheduler/seed   (VESSEL·REMOTE_SITE_URL·NODE_TOKEN 은 env)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const remoteSiteUrl = process.env.REMOTE_SITE_URL;
  const vesselNo = process.env.VESSEL ?? '';
  const token = process.env.NODE_TOKEN;

  if (!remoteSiteUrl) {
    return NextResponse.json({ success: false, message: 'REMOTE_SITE_URL not set' }, { status: 400 });
  }
  if (!vesselNo) {
    return NextResponse.json({ success: false, message: 'VESSEL not set' }, { status: 400 });
  }

  try {
    const { total, counts } = await runSeed({ remoteSiteUrl, vesselNo, token });
    return NextResponse.json({ success: true, vessel_no: vesselNo, total, counts });
  } catch (err) {
    console.error('[scheduler/seed]', err);
    const msg = (err as Error).message || 'Server error';
    const status = msg.startsWith('remote seed failed') ? 502 : 500;
    return NextResponse.json({ success: false, message: msg }, { status });
  }
}
