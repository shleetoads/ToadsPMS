import { NextResponse } from 'next/server';
import { withTransaction } from '@/db';
import { verifyNode } from '@/lib/sync/nodeAuth';
import { getTableColumns, DOWNLOAD_TABLE_MAP } from '@/lib/sync/upsert';
import { rawQuery } from '@/lib/sync/rawQuery';

// 중앙 → 엣지 다운로드 (download-only + 양방향 마스터), vessel 1척 스코프.
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.3, §11
//
// 노드 토큰 게이트웨이 + vessel 스코프 강제 + change_seq 델타 조회.
// full=true 또는 커서 0 이면 전량, 아니면 change_seq>cursor 증분.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

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

  // 3) vessel 스코프 강제 — 노드는 자기 선박만 조회 가능
  const vesselNo = body?.vessel_no ?? auth.node.vesselNo;
  if (body?.vessel_no !== undefined && body.vessel_no !== auth.node.vesselNo) {
    return NextResponse.json({ success: false, message: 'Vessel scope mismatch' }, { status: 403 });
  }
  const cursor = Number(body?.cursor) || 0;
  const full = body?.full === true;

  try {
    const rows: Record<string, any[]> = {};
    const totals: Record<string, number> = {};
    const modes: Record<string, 'delta' | 'full'> = {};
    let maxSeq: number | null = null;

    await withTransaction(async (client) => {
      for (const { table, scope } of DOWNLOAD_TABLE_MAP) {
        const cols = await getTableColumns(client, table);
        if (cols.size === 0) continue; // 로컬(중앙)에 없는 테이블 스킵

        const hasChangeSeq = cols.has('change_seq');
        const conds: string[] = [];
        const params: any[] = [];

        // 스코프 필터
        if (scope === 'vessel' && cols.has('vessel_no')) {
          params.push(vesselNo);
          conds.push(`${q('vessel_no')} = $${params.length}`);
        } else if (scope === 'ship_no' && cols.has('ship_no')) {
          params.push(vesselNo);
          conds.push(`${q('ship_no')} = $${params.length}`);
        }
        // scope === 'global' → 필터 없음

        // 델타/전량 판정
        const delta = !full && cursor > 0 && hasChangeSeq;
        if (delta) {
          params.push(cursor);
          conds.push(`${q('change_seq')} > $${params.length}`);
        }
        modes[table] = delta ? 'delta' : 'full';

        const where = conds.length ? ` where ${conds.join(' and ')}` : '';
        // rawQuery: 날짜/시간을 PostgreSQL 원문 문자열로 받아 TZ 왜곡 없이 전송(§rawQuery)
        const selected = await rawQuery(client, `select * from ${q(table)}${where}`, params);
        rows[table] = selected;
        totals[table] = selected.length;

        // 이번 응답에 포함된 모든 행의 max(change_seq) 추적(bigint는 string → Number)
        for (const row of selected) {
          if (row.change_seq != null) {
            const n = Number(row.change_seq);
            if (maxSeq === null || n > maxSeq) maxSeq = n;
          }
        }
      }
    });

    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    return NextResponse.json({
      success: true,
      vessel_no: vesselNo,
      cursor,
      max_seq: maxSeq,
      modes,
      totals,
      total,
      rows,
    });
  } catch (err) {
    console.error('[sync/download]', err);
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 });
  }
}
