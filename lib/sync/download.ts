// lib/sync/download.ts
// 중앙 → 엣지 다운로드. sync_state(download) 커서 이후의 변경분을 중앙 /api/sync/download 에서
// 받아 로컬에 멱등 적용하고, 수신 max(change_seq)로 커서를 전진한다.
//
// 안전망: 중앙 델타(change_seq>cursor)도 커밋 순서 역전 틈이 있고, 공유 중앙 DB 라
// 행별 표시로는 보정할 수 없다. 그래서 마지막 전량 수신이 SYNC_FULL_EVERY_HOURS(기본 24h)
// 보다 오래됐으면 이번 회차를 '전량(full)'으로 받아 틈을 메운다(최후 보정).
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.3
import { query, execute, withTransaction } from '@/db';
import { upsertRows, DOWNLOAD_TABLE_MAP } from './upsert';

export type DownloadResult = {
  total: number;              // 로컬에 실제 적용된 행 수
  received: number;           // 중앙에서 받은 행 수
  counts: Record<string, number>;
  mode: 'full' | 'delta';
  maxSeq: number | null;
};

export async function runDownload(opts: {
  remoteSiteUrl: string;
  vesselNo: string;
  token?: string;
  full?: boolean;
}): Promise<DownloadResult> {
  // 1) 다운로드 커서
  const stateRows = await query<{ last_seq: string }>(
    `select last_seq from sync_state where peer = 'central' and direction = 'download'`
  );
  const downloadCursor = stateRows.length ? Number(stateRows[0].last_seq) || 0 : 0;

  // 전량 수신 판정: 수동 full / 최초(커서 0) / 마지막 전량이 오래됨(SQL 로 경과초 계산 — TZ 무관)
  const fullHours = Number(process.env.SYNC_FULL_EVERY_HOURS) || 24;
  const fullRows = await query<{ age: string | null }>(
    `select extract(epoch from (now()::timestamp - last_success_at)) as age
       from sync_state where peer = 'central' and direction = 'full'`
  );
  const fullStale = !fullRows.length || fullRows[0].age == null
    ? true
    : Number(fullRows[0].age) > fullHours * 3600;
  const requestFull = opts.full === true || downloadCursor === 0 || fullStale;

  // 2) 중앙 요청 (회선 불안정 대비 타임아웃)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) {
    headers['Authorization'] = `Bearer ${opts.token}`;
    headers['X-Vessel-No'] = opts.vesselNo;
  }
  const timeoutMs = Number(process.env.SYNC_HTTP_TIMEOUT_MS) || 60000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${opts.remoteSiteUrl}/api/sync/download`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ vessel_no: opts.vesselNo, cursor: downloadCursor, full: requestFull }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`remote download failed: HTTP ${res.status}`);
  }
  const payload: any = await res.json();
  const rowsByTable: Record<string, any[]> = payload?.rows ?? {};
  const maxSeq: number | null = typeof payload?.max_seq === 'number' ? payload.max_seq : null;
  const received = Object.values(rowsByTable).reduce(
    (a, v) => a + (Array.isArray(v) ? v.length : 0),
    0
  );

  // 3) 멱등 적용 (에코 차단) — FK 순서 유지
  const sharedUpsert = process.env.SYNC_SHARED_UPSERT === 'on';
  const counts: Record<string, number> = {};
  await withTransaction(async (client) => {
    await client.query("SET LOCAL app.sync_apply = 'on'"); // 받은 행이 로컬 델타에 재진입하지 않도록(F2)
    for (const { table, pk, shared, overriding } of DOWNLOAD_TABLE_MAP) {
      if (shared) {
        // 공유(문서 프로젝트 소유) 마스터: 기본은 신규 삽입만(기존 행 보존).
        // SYNC_SHARED_UPSERT=on 이면 덮어쓰기 허용.
        counts[table] = await upsertRows(client, table, pk, rowsByTable[table], {
          stampReceiveDate: false,
          overriding,
          insertOnly: !sharedUpsert,
        });
      } else {
        // 일반 테이블: 아직 중앙에 보내지 않은 로컬 변경은 덮지 않음(guardUnsent).
        counts[table] = await upsertRows(client, table, pk, rowsByTable[table], {
          stampReceiveDate: false,
          guardUnsent: true,
        });
      }
    }
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // 4) 다운로드 커서 전진 — 수신 max_seq 가 기존보다 크면 last_seq 갱신, 성공 시 last_success_at 항상 갱신
  if (maxSeq !== null && maxSeq > downloadCursor) {
    await execute(
      `update sync_state set last_seq = @seq, last_success_at = now()::timestamp
        where peer = 'central' and direction = 'download'`,
      [{ name: 'seq', value: maxSeq }]
    );
  } else {
    await execute(
      `update sync_state set last_success_at = now()::timestamp
        where peer = 'central' and direction = 'download'`
    );
  }

  // 5) 전량 수신이었다면 'full' 성공 시각 기록(다음 전량까지 카운트다운 기준)
  if (requestFull) {
    await execute(
      `insert into sync_state (peer, direction, last_seq, last_success_at)
         values ('central','full',0, now()::timestamp)
       on conflict (peer, direction) do update set last_success_at = now()::timestamp`
    );
  }

  return { total, received, counts, mode: requestFull ? 'full' : 'delta', maxSeq };
}
