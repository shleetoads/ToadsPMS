// lib/sync/seed.ts
// 신규 엣지 온보딩: 중앙 /api/sync/seed 에서 vessel 전체(마스터+이력+user)를 받아 로컬을 채운다.
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §9.2, CENTRAL_REDEPLOY_PLAN §2.1
import { withTransaction } from '@/db';
import { upsertRows, SEED_TABLE_MAP } from './upsert';

export type SeedResult = { total: number; counts: Record<string, number> };

/**
 * 최초 1회 전체 시드. 평상시 수신(runReceive)과 달리 이력·user 까지 전부 적재.
 * 수신 rows 에서 change_seq 는 제거한다 — 엣지는 자기 시퀀스를 쓰므로 중앙 seq 를 넣으면
 * 시드 이력이 엣지의 업로드 델타에 잘못 잡힌다(app.sync_apply='on' 로 트리거는 억제되지만
 * 페이로드에 값이 있으면 그대로 INSERT되므로 명시적으로 제거).
 */
export async function runSeed(opts: {
  remoteSiteUrl: string;
  vesselNo: string;
  token?: string;
}): Promise<SeedResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) {
    headers['Authorization'] = `Bearer ${opts.token}`;
    headers['X-Vessel-No'] = opts.vesselNo;
  }

  const res = await fetch(`${opts.remoteSiteUrl}/api/sync/seed`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ vessel_no: opts.vesselNo }),
  });
  if (!res.ok) {
    throw new Error(`remote seed failed: HTTP ${res.status}`);
  }
  const payload: any = await res.json();
  const bundle: Record<string, any[]> = payload?.bundle ?? {};

  const counts: Record<string, number> = {};
  await withTransaction(async (client) => {
    await client.query("SET LOCAL app.sync_apply = 'on'"); // 시드 행이 로컬 델타에 재진입하지 않도록
    for (const { table, pk } of SEED_TABLE_MAP) {
      const rows = (bundle[table] ?? []).map((r) => {
        const { change_seq, ...rest } = r; // 중앙 seq 제거(엣지는 자기 시퀀스 사용)
        return rest;
      });
      // stampReceiveDate=false: 시드 행엔 이미 last_receive_date 가 포함돼 있고(중복 할당 방지),
      // user 처럼 last_receive_date 컬럼이 없는 테이블도 있으므로 헬퍼의 자동 스탬프를 끈다.
      counts[table] = await upsertRows(client, table, pk, rows, false);
    }
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { total, counts };
}
