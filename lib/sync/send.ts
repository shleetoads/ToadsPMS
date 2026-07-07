// lib/sync/send.ts
// 엣지 → 중앙 업로드. change_seq 델타로 변경분만 수집해 중앙 /api/sync/upload 로 전송,
// 성공 시 sync_state(upload) 커서를 전진(응답 ok 후에만).
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.3
import { query, execute } from '@/db';
import { UPLOAD_TABLE_MAP } from './upsert';

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

export type SendResult = { total: number; sentSeq: number | null; counts: Record<string, number> };

export async function runSend(opts: {
  remoteSiteUrl: string;
  vesselNo: string;
  token?: string;
}): Promise<SendResult> {
  // 1) 업로드 커서
  const stateRows = await query<{ last_seq: string }>(
    `select last_seq from sync_state where peer = 'central' and direction = 'upload'`
  );
  const cursor = stateRows.length ? Number(stateRows[0].last_seq) : 0;

  // 2) 변경분 수집 (change_seq > cursor → 시드행(NULL)·기수신분 제외)
  const rowsByTable: Record<string, any[]> = {};
  const counts: Record<string, number> = {};
  let maxSeq = cursor;
  for (const { table } of UPLOAD_TABLE_MAP) {
    const rows = await query<any>(
      `select * from ${q(table)} where vessel_no = @v and change_seq > @c order by change_seq`,
      [{ name: 'v', value: opts.vesselNo }, { name: 'c', value: cursor }]
    );
    if (rows.length) {
      rowsByTable[table] = rows;
      counts[table] = rows.length;
      for (const r of rows) if (r.change_seq != null && Number(r.change_seq) > maxSeq) maxSeq = Number(r.change_seq);
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return { total: 0, sentSeq: null, counts: {} };

  // 3) 중앙 전송
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) {
    headers['Authorization'] = `Bearer ${opts.token}`;
    headers['X-Vessel-No'] = opts.vesselNo;
  }
  const res = await fetch(`${opts.remoteSiteUrl}/api/sync/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ cursor, rows: rowsByTable }),
  });
  if (!res.ok) {
    throw new Error(`remote upload failed: HTTP ${res.status}`);
  }

  // 4) 응답 ok 후에만 커서 전진
  await execute(
    `update sync_state set last_seq = @seq, last_success_at = now()::timestamp
      where peer = 'central' and direction = 'upload'`,
    [{ name: 'seq', value: maxSeq }]
  );

  return { total, sentSeq: maxSeq, counts };
}
