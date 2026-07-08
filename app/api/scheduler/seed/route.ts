import { NextResponse } from 'next/server';
import { query } from '@/db';
import { runSeed } from '@/lib/sync/seed';

// 엣지 온보딩 트리거. 중앙에서 vessel 전체를 받아 로컬을 채운다.
// 설계: CENTRAL_REDEPLOY_PLAN §2.1
// 사용:
//   GET /api/scheduler/seed             → 항상 시드(강제)
//   GET /api/scheduler/seed?ifEmpty=1   → 로컬이 비어있을 때만(최초 기동 자동 온보딩용)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const remoteSiteUrl = process.env.REMOTE_SITE_URL;
  const vesselNo = process.env.VESSEL ?? '';
  const token = process.env.NODE_TOKEN;
  const ifEmpty = new URL(req.url).searchParams.get('ifEmpty');

  if (!remoteSiteUrl) {
    return NextResponse.json({ success: false, message: 'REMOTE_SITE_URL not set' }, { status: 400 });
  }
  if (!vesselNo) {
    return NextResponse.json({ success: false, message: 'VESSEL not set' }, { status: 400 });
  }

  try {
    // ifEmpty: 이미 온보딩된 노드면(자기 vessel 행 존재) 건너뜀
    if (ifEmpty) {
      const existing = await query(`select 1 from vessel where vessel_no = @v limit 1`, [
        { name: 'v', value: vesselNo },
      ]);
      if (existing.length > 0) {
        return NextResponse.json({ success: true, seeded: false, reason: 'already onboarded' });
      }
    }

    const { total, counts } = await runSeed({ remoteSiteUrl, vesselNo, token });
    return NextResponse.json({ success: true, seeded: true, vessel_no: vesselNo, total, counts });
  } catch (err) {
    console.error('[scheduler/seed]', err);
    const msg = (err as Error).message || 'Server error';
    const status = msg.startsWith('remote seed failed') ? 502 : 500;
    return NextResponse.json({ success: false, message: msg }, { status });
  }
}
