// lib/sync/send.ts
// 엣지 → 중앙 업로드.
// 워터마크(change_seq>last_seq) 방식은 커밋 순서 역전 시 행을 건너뛸 수 있어 폐기하고,
// 참조 'document' 프로젝트와 동일하게 '행별 전송 표시(sent_seq)' 방식을 쓴다:
//   PENDING = change_seq IS NOT NULL AND (sent_seq IS NULL OR sent_seq <> change_seq)
//   → 미전송 행을 수집해 전송, 중앙이 ack 한 뒤에만 sent_seq = change_seq 로 표시.
//   전송 중 다시 수정된 행은 새 change_seq 를 가져 표시에서 제외되고 다음 회차에 재전송된다.
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.3
import { execute, withTransaction } from '@/db';
import { UPLOAD_TABLE_MAP, getTableColumns } from './upsert';
import { rawQuery } from './rawQuery';

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

// change_seq/sent_seq 가 없어 업로드 대상에서 제외한 테이블 경고 중복 방지(프로세스당 1회).
const skipWarned = new Set<string>();

export type SendResult = { total: number; sentSeq: number | null; counts: Record<string, number> };

export async function runSend(opts: {
  remoteSiteUrl: string;
  vesselNo: string;
  token?: string;
}): Promise<SendResult> {
  // 1) 미전송 행 수집 — REPEATABLE READ 스냅샷으로 일관되게 읽고, HTTP 전에 읽기 트랜잭션을 닫는다.
  //    (SET TRANSACTION … 은 BEGIN 직후 '첫 문장' 이어야 하므로 콜백의 최초 쿼리로 실행)
  const pending: Record<string, any[]> = {};
  await withTransaction(async (client) => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    for (const { table } of UPLOAD_TABLE_MAP) {
      const cols = await getTableColumns(client, table);
      if (!cols.has('change_seq') || !cols.has('sent_seq')) {
        if (!skipWarned.has(table)) {
          skipWarned.add(table);
          console.warn(`[sync/send] '${table}' 에 change_seq/sent_seq 가 없어 업로드 대상에서 제외합니다.`);
        }
        continue;
      }
      const rows = await rawQuery(
        client,
        `select * from ${q(table)}
           where vessel_no = $1
             and change_seq is not null
             and (sent_seq is null or sent_seq <> change_seq)
           order by change_seq`,
        [opts.vesselNo]
      );
      if (rows.length) pending[table] = rows;
    }
  });

  const total = Object.values(pending).reduce((a, v) => a + v.length, 0);
  if (total === 0) return { total: 0, sentSeq: null, counts: {} };

  // 2) 배치 전송 + ack 후 표시 (UPLOAD_TABLE_MAP 순서 보존: 부모 → 자식)
  const batchLimit = Number(process.env.SYNC_UPLOAD_BATCH) || 2000;
  const counts: Record<string, number> = {};
  let maxSent = 0;

  let curRows: Record<string, any[]> = {};   // 전송 페이로드(change_seq/sent_seq 제거됨)
  let curSeqs: Record<string, any[]> = {};    // 표시용 change_seq 목록(bigint → string)
  let curSize = 0;

  const flush = async () => {
    if (curSize === 0) return;
    await postBatch(opts, curRows);           // 실패 시 throw → 이미 표시된 앞선 배치는 보존
    await markBatch(opts.vesselNo, curSeqs);  // 중앙 ack 후에만 표시
    curRows = {};
    curSeqs = {};
    curSize = 0;
  };

  for (const { table } of UPLOAD_TABLE_MAP) {
    const rows = pending[table];
    if (!rows || !rows.length) continue;
    counts[table] = rows.length;
    for (const row of rows) {
      const { change_seq, sent_seq, ...rest } = row; // 전송에서 두 컬럼 제거
      void sent_seq;
      if (!curRows[table]) { curRows[table] = []; curSeqs[table] = []; }
      curRows[table].push(rest);
      curSeqs[table].push(change_seq);
      const n = Number(change_seq);
      if (n > maxSent) maxSent = n;
      curSize++;
      if (curSize >= batchLimit) await flush(); // 단일 테이블이 커도 분할(표시는 change_seq 배열 기준)
    }
  }
  await flush();

  // 3) sync_state(upload) — 표시된 최대 change_seq(표시/진단용) + 성공 시각
  await execute(
    `update sync_state set last_seq = @seq, last_success_at = now()::timestamp
      where peer = 'central' and direction = 'upload'`,
    [{ name: 'seq', value: maxSent }]
  );

  return { total, sentSeq: maxSent, counts };
}

/** 한 배치를 중앙 /api/sync/upload 로 전송. 실패하면 throw. */
async function postBatch(
  opts: { remoteSiteUrl: string; vesselNo: string; token?: string },
  rowsByTable: Record<string, any[]>
): Promise<void> {
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
    res = await fetch(`${opts.remoteSiteUrl}/api/sync/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rows: rowsByTable }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`remote upload failed: HTTP ${res.status}`);
  const j: any = await res.json().catch(() => ({}));
  if (!j?.success) throw new Error(`remote upload failed: ${j?.message ?? 'no success flag'}`);
}

/**
 * 중앙 ack 후 로컬에 전송 표시. app.sync_apply='on' 으로 트리거의 change_seq 재부여를 억제한다
 * (표시 UPDATE 가 새 변경으로 잡히지 않도록). 전송 중 재수정된 행은 change_seq 가 달라 매칭되지
 * 않으므로 미전송으로 남는다 — 의도된 동작.
 */
async function markBatch(vesselNo: string, seqsByTable: Record<string, any[]>): Promise<void> {
  await withTransaction(async (client) => {
    await client.query("SET LOCAL app.sync_apply = 'on'");
    for (const [table, seqs] of Object.entries(seqsByTable)) {
      if (!seqs.length) continue;
      await client.query(
        `update ${q(table)} set sent_seq = change_seq
          where vessel_no = $1 and change_seq = any($2::bigint[])`,
        [vesselNo, seqs]
      );
    }
  });
}
