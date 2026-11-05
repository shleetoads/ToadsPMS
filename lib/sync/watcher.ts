// lib/sync/watcher.ts
// 선상 엣지: 고정 주기 동기화 트리거 (설계 D5, §8).
// 서버 기동 직후 1회 + 이후 고정 간격(기본 10분)으로 로컬 /api/scheduler/sync 를 호출한다.
//
// 중요: 이 모듈은 instrumentation 그래프에 포함되므로 db(pg)를 직접 import하지 않는다.
// 오직 자기 프로세스의 HTTP 엔드포인트만 호출한다 → pg가 instrumentation 번들에 섞이는 문제 회피.

let started = false;

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** 연결 거부(로컬 서버 아직 미기동) 판별 */
function isConnRefused(err: any): boolean {
  const code = err?.cause?.code ?? err?.code;
  const msg = err?.message ?? '';
  return code === 'ECONNREFUSED' || /ECONNREFUSED|fetch failed/i.test(msg);
}

/** 자동 동기화 1회 호출. 절대 throw 하지 않음. { thrown } 로 네트워크 예외 여부만 알린다. */
async function runOnce(localUrl: string): Promise<{ thrown: boolean; err?: any }> {
  try {
    const res = await fetch(`${localUrl}/api/scheduler/sync?trigger=auto`, { method: 'POST' });
    const j: any = await res.json().catch(() => ({}));
    if (res.ok && j?.success) {
      console.log(`[watcher] sync ok: up=${j.uploaded} down=${j.downloaded} mode=${j.mode ?? '-'}`);
    } else {
      console.error(`[watcher] sync failed: ${j?.message ?? `HTTP ${res.status}`}`);
    }
    return { thrown: false };
  } catch (err) {
    console.error('[watcher] sync 호출 오류:', (err as Error).message);
    return { thrown: true, err };
  }
}

/** 최초 1회. 로컬 서버가 아직 리스닝 전(연결 거부)이면 15초 간격 최대 5회 재시도. */
async function firstRun(localUrl: string): Promise<void> {
  for (let retries = 0; ; retries++) {
    const r = await runOnce(localUrl);
    if (!r.thrown || !isConnRefused(r.err) || retries >= 5) return;
    console.log(`[watcher] 로컬 서버 미기동(연결 거부) — 15초 후 재시도 (${retries + 1}/5)`);
    await sleep(15000);
  }
}

export function startWatcher(): void {
  if (started) return;

  const remote = process.env.REMOTE_SITE_URL;
  const vessel = process.env.VESSEL;
  // 자기 자신(같은 프로세스의 HTTP 서버)을 호출해야 하므로 항상 자기 PORT 사용.
  const localUrl = `http://127.0.0.1:${process.env.PORT || 30001}`;
  if (!remote || !vessel) {
    console.log('[watcher] disabled (REMOTE_SITE_URL/VESSEL 미설정)');
    return;
  }

  const interval = Number(process.env.SYNC_INTERVAL_MS) || 600000;       // 기본 10분
  const startupDelay = Number(process.env.SYNC_STARTUP_DELAY_MS) || 15000; // 기동 후 첫 실행 지연
  started = true;
  console.log(`[watcher] started interval=${interval}ms remote=${remote} vessel=${vessel}`);

  setTimeout(() => void firstRun(localUrl), startupDelay);
  setInterval(() => void runOnce(localUrl), interval);
}
