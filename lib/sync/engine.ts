// lib/sync/engine.ts
// 선상 엣지 동기화 단일 진입점: (스키마 보강 →) 업로드 → 다운로드 순차 실행, 동시 실행 뮤텍스, 상태 보관.
// watcher(자동)와 헤더 버튼(수동)이 모두 이 엔진을 통해 1회 동기화를 돌린다.
// 업로드는 '행별 전송 표시(sent_seq)' 방식이라 실패해도 로컬 변경이 유실되지 않는다.
// 설계: 문서(document) 프로젝트 sync 미러 — 선박이 주도(push→pull).
import { query } from '@/db';
import { runSend } from './send';
import { runDownload } from './download';
import { ensureEdgeSyncSchema } from './edgeSchema';
import { UPLOAD_TABLE_MAP } from './upsert';

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

export type SyncLast = {
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  trigger: 'auto' | 'manual';
  uploaded: number;
  downloaded: number;
  message: string;
} | null;

type SyncState = { running: boolean; last: SyncLast };

// 라우트 모듈이 각기 번들되더라도 상태를 공유하도록 globalThis 에 보관.
const g = globalThis as unknown as { __pmsSyncEngine?: SyncState };
if (!g.__pmsSyncEngine) g.__pmsSyncEngine = { running: false, last: null };
const state: SyncState = g.__pmsSyncEngine;

/** 이 서버가 선박(엣지) 서버인지 */
export function isEdge(): boolean {
  return (
    process.env.NODE_ROLE !== 'central' &&
    !!process.env.REMOTE_SITE_URL &&
    !!process.env.VESSEL
  );
}

function intervalMs(): number {
  return Number(process.env.SYNC_INTERVAL_MS) || 600000;
}

/** 중앙으로 보낼 미전송 변경 행 수(업로드 테이블 합계). 컬럼/테이블 없으면 0 으로 관대히 처리. */
async function countPending(vesselNo: string): Promise<number> {
  if (!vesselNo) return 0;
  try {
    const colRows = await query<{ table_name: string }>(
      `select table_name from information_schema.columns
         where table_schema = current_schema() and column_name in ('change_seq','sent_seq')`
    );
    const both: Record<string, number> = {};
    for (const r of colRows) both[r.table_name] = (both[r.table_name] || 0) + 1;

    let total = 0;
    for (const { table } of UPLOAD_TABLE_MAP) {
      if (both[table] !== 2) continue; // change_seq·sent_seq 둘 다 있는 테이블만
      const c = await query<{ n: number }>(
        `select count(*)::int as n from ${q(table)}
           where vessel_no = @v and change_seq is not null
             and (sent_seq is null or sent_seq <> change_seq)`,
        [{ name: 'v', value: vesselNo }]
      );
      total += c.length ? Number(c[0].n) : 0;
    }
    return total;
  } catch {
    return 0;
  }
}

/** 오류 → 사용자용 한국어 메시지 */
function toUserMessage(err: any): string {
  const msg = err?.message ?? String(err);
  const name = err?.name ?? '';
  // 네트워크/타임아웃(fetch 실패, AbortController 중단 등)
  if (
    name === 'AbortError' ||
    /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|network|timeout|aborted/i.test(msg)
  ) {
    return '중앙 서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.';
  }
  // 인증 실패
  if (/HTTP 401|HTTP 403/.test(msg)) {
    return '중앙 서버 인증에 실패했습니다. 노드 토큰을 확인하세요.';
  }
  return msg;
}

export type RunSyncResult = {
  ok: boolean;
  busy?: boolean;
  uploaded: number;
  downloaded: number;
  mode?: 'full' | 'delta';
  message: string;
  last: SyncLast;
};

/**
 * 1회 동기화: (0) 엣지 스키마 보강 → (1) 업로드 → (2) 다운로드.
 * 업로드가 실패하면 다운로드는 생략한다(미업로드 로컬 변경을 오래된 중앙 데이터가 덮지 못하도록).
 * 업로드는 sent_seq 표시 기반이라 실패해도 로컬 변경은 보존된다(다음 회차 재전송).
 */
export async function runSyncOnce(
  trigger: 'auto' | 'manual',
  opts?: { full?: boolean }
): Promise<RunSyncResult> {
  if (state.running) {
    return {
      ok: false,
      busy: true,
      uploaded: 0,
      downloaded: 0,
      message: '동기화가 이미 진행 중입니다.',
      last: state.last,
    };
  }

  state.running = true;
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  const remoteSiteUrl = process.env.REMOTE_SITE_URL ?? '';
  const vesselNo = process.env.VESSEL ?? '';
  const token = process.env.NODE_TOKEN;

  let uploaded = 0;
  let downloaded = 0;
  let mode: 'full' | 'delta' | undefined;
  let ok = false;
  let message = '동기화 완료';

  try {
    // step 0: 스키마 보강(멱등). 실패하면 그 메시지로 동기화 실패 보고.
    await ensureEdgeSyncSchema();

    // step 1: 업로드(push). 던지면 아래 catch → step 2 미실행.
    const send = await runSend({ remoteSiteUrl, vesselNo, token });
    uploaded = send.total;

    // step 2: 다운로드(pull) — 업로드 성공 후에만.
    const down = await runDownload({ remoteSiteUrl, vesselNo, token, full: opts?.full });
    downloaded = down.total;
    mode = down.mode;

    ok = true;
  } catch (err) {
    // 실패해도 미전송 로컬 변경은 그대로 남아 다음 회차에 재전송된다(유실 없음).
    message = toUserMessage(err);
    ok = false;
  } finally {
    state.running = false;
  }

  const pending = await countPending(vesselNo);
  const finishedAt = new Date().toISOString();
  state.last = { startedAt, finishedAt, ok, trigger, uploaded, downloaded, message };
  console.log(
    `[sync] trigger=${trigger} ok=${ok} up=${uploaded} down=${downloaded} pending=${pending} (${Date.now() - t0}ms)`
  );

  return { ok, uploaded, downloaded, mode, message, last: state.last };
}

export type SyncStatus = {
  edge: boolean;
  vessel_no: string | null;
  remote: string | null;
  running: boolean;
  last: SyncLast;
  lastUploadAt: string | null;
  lastDownloadAt: string | null;
  lastFullAt: string | null;
  pending: number;
  intervalMs: number;
};

/**
 * 현재 동기화 상태 + 마지막 성공 시각. DB 는 DB 서버 존의 벽시계를 저장하고 Node 는 다른 존일 수
 * 있으므로 timestamp 원문을 브라우저로 보내지 않는다. 대신 경과초를 SQL 로 구해 ISO 로 환산한다.
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const edge = isEdge();
  if (!edge) {
    return {
      edge: false,
      vessel_no: null,
      remote: null,
      running: state.running,
      last: state.last,
      lastUploadAt: null,
      lastDownloadAt: null,
      lastFullAt: null,
      pending: 0,
      intervalMs: intervalMs(),
    };
  }

  const vesselNo = process.env.VESSEL ?? '';
  const iso = (age: number | null): string | null =>
    age == null ? null : new Date(Date.now() - age * 1000).toISOString();

  let lastUploadAt: string | null = null;
  let lastDownloadAt: string | null = null;
  let lastFullAt: string | null = null;
  try {
    const rows = await query<{ direction: string; age: number | null }>(
      `select direction, extract(epoch from (now()::timestamp - last_success_at))::int as age
         from sync_state where peer = 'central' and direction in ('upload', 'download', 'full')`
    );
    for (const r of rows) {
      if (r.direction === 'upload') lastUploadAt = iso(r.age);
      else if (r.direction === 'download') lastDownloadAt = iso(r.age);
      else if (r.direction === 'full') lastFullAt = iso(r.age);
    }
  } catch {
    // sync_state 미생성/조회 실패 → null 유지(비치명적)
  }

  const pending = await countPending(vesselNo);

  return {
    edge: true,
    vessel_no: vesselNo || null,
    remote: process.env.REMOTE_SITE_URL ?? null,
    running: state.running,
    last: state.last,
    lastUploadAt,
    lastDownloadAt,
    lastFullAt,
    pending,
    intervalMs: intervalMs(),
  };
}
