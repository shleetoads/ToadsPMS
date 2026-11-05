// lib/sync/receive.ts
// 선상 엣지 ↔ 중앙 동기화: 수신(중앙 → 로컬) 핵심 로직.
// 라우트(app/api/scheduler/receive)와 회선 감지 감시자(watcher)가 공용.
// 설계 근거: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.3
import { withTransaction } from '@/db';
import { upsertRows, RECEIVE_TABLE_MAP } from './upsert';

export type ReceiveResult = { total: number; counts: Record<string, number> };

/**
 * 중앙의 기존 /api/data/all/get(읽기 전용)에서 vessel 데이터 번들을 받아
 * 로컬에 ON CONFLICT 멱등 적용한다. (F1: MERGE 금지, F2: 에코 차단)
 */
export async function runReceive(opts: {
  remoteSiteUrl: string;
  vesselNo: string;
  since?: string;
}): Promise<ReceiveResult> {
  const since = opts.since || '1900-01-01';

  const res = await fetch(`${opts.remoteSiteUrl}/api/data/all/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vessel_no: opts.vesselNo, last_receive_date: since }),
  });
  if (!res.ok) {
    throw new Error(`remote get failed: HTTP ${res.status}`);
  }
  const bundle: Record<string, any[]> = await res.json();

  const counts: Record<string, number> = {};
  await withTransaction(async (client) => {
    await client.query("SET LOCAL app.sync_apply = 'on'"); // 받은 행이 로컬 델타에 재진입하지 않도록(F2)
    for (const { key, table, pk } of RECEIVE_TABLE_MAP) {
      // 레거시 수신: 갱신 시 last_receive_date 스탬프 유지(해당 컬럼 보유 테이블만).
      counts[table] = await upsertRows(client, table, pk, bundle[key], { stampReceiveDate: true });
    }
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { total, counts };
}
