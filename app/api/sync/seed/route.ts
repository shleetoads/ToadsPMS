import { NextResponse } from 'next/server';
import { query } from '@/db';
import { verifyNode } from '@/lib/sync/nodeAuth';

// 온보딩 전체 시드 (중앙 → 신규 엣지, 최초 1회).
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §9.2 (V3), CENTRAL_REDEPLOY_PLAN §2.1
//
// 평상시 수신(data/all/get)은 다운로드 방향 마스터만 준다.
// 온보딩은 그 선박이 "로컬에서 완전히 돌기 위한" 전체가 필요하다:
//   - 마스터: vessel, machine, equipment, section, maintenance_plan, maintenance_extension, material, warehouse
//   - 이력  : maintenance_work, used_parts, receive, release, loss   (업로드-소유지만 과거분은 내려줘야 함)
//   - 계정  : user (ship_no 기준 — 오프라인 로그인)
// 전부 읽기 전용 SELECT. vessel_no 로 스코프.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// vessel_no 컬럼으로 필터되는 테이블
const VESSEL_TABLES = [
  'vessel', 'machine', 'equipment', 'section', 'maintenance_plan', 'maintenance_extension',
  'material', 'warehouse', 'maintenance_work', 'used_parts', 'receive', 'release', 'loss',
];

export async function POST(req: Request) {
  // 1) 노드 인증 (중앙에서는 토큰 강제)
  const auth = await verifyNode(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  // 2) vessel 스코프 (기본: 노드 자신)
  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const vesselNo = body?.vessel_no || auth.node.vesselNo;
  if (!vesselNo) {
    return NextResponse.json({ success: false, message: 'vessel_no required' }, { status: 400 });
  }
  if (auth.node.vesselNo && vesselNo !== auth.node.vesselNo) {
    return NextResponse.json({ success: false, message: 'vessel scope mismatch' }, { status: 403 });
  }

  try {
    const bundle: Record<string, any[]> = {};
    for (const t of VESSEL_TABLES) {
      bundle[t] = await query(`select * from "${t}" where vessel_no = @v`, [{ name: 'v', value: vesselNo }]);
    }
    // user 는 vessel_no 가 없고 ship_no(FK) 로 연결 → 해당 선박 승선원만
    bundle['user'] = await query(`select * from "user" where ship_no = @v`, [{ name: 'v', value: vesselNo }]);

    const totals: Record<string, number> = {};
    for (const [k, v] of Object.entries(bundle)) totals[k] = v.length;
    const total = Object.values(totals).reduce((a, b) => a + b, 0);

    return NextResponse.json({ success: true, vessel_no: vesselNo, total, totals, bundle });
  } catch (err) {
    console.error('[sync/seed]', err);
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 });
  }
}
