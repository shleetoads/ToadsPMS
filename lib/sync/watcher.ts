// lib/sync/watcher.ts
// 선상 엣지: 회선 감지 트리거 (설계 D5, §8)
// 중앙 도달성을 주기적으로 확인하고, offline→online 전이 순간 자동 수신을 실행한다.
//
// 중요: 이 모듈은 instrumentation 그래프에 포함되므로 db(pg)를 직접 import하지 않는다.
// 대신 로컬 수신 엔드포인트를 HTTP로 호출한다 → pg가 instrumentation 번들에 섞이는 문제 회피.

let started = false;
let syncing = false;   // 동시 실행 방지 뮤텍스
let online = false;    // 마지막 회선 상태

/** 중앙 도달성 확인: 루트 GET에 짧은 타임아웃. 5xx/네트워크오류 = 도달 불가. */
async function probe(remote: string, timeoutMs: number): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${remote}/`, { method: 'GET', signal: ctrl.signal });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** 로컬 수신 엔드포인트를 호출. 성공 여부 반환. */
async function triggerReceive(localUrl: string): Promise<boolean> {
  if (syncing) return false;
  syncing = true;
  try {
    const res = await fetch(`${localUrl}/api/scheduler/receive`);
    const j: any = await res.json().catch(() => ({}));
    if (res.ok && j?.success) {
      console.log(`[watcher] receive ok: total=${j.total}`, j.counts);
      return true;
    }
    console.error('[watcher] receive failed:', j?.message ?? `HTTP ${res.status}`);
    return false;
  } catch (err) {
    console.error('[watcher] receive trigger error:', (err as Error).message);
    return false;
  } finally {
    syncing = false;
  }
}

export function startWatcher(): void {
  if (started) return;

  const remote = process.env.REMOTE_SITE_URL;
  const vessel = process.env.VESSEL;
  const localUrl = process.env.LOCAL_SITE_URL || 'http://localhost:30001';
  if (!remote || !vessel) {
    console.log('[watcher] disabled (REMOTE_SITE_URL/VESSEL 미설정)');
    return;
  }

  const pollMs = Number(process.env.SYNC_POLL_MS) || 20000;
  const probeTimeoutMs = Number(process.env.SYNC_PROBE_TIMEOUT_MS) || 3000;
  started = true;
  console.log(`[watcher] started poll=${pollMs}ms remote=${remote} vessel=${vessel}`);

  const tick = async () => {
    const reachable = await probe(remote, probeTimeoutMs);
    if (!reachable) {
      if (online) { online = false; console.log('[watcher] connectivity online→offline (수신 보류)'); }
      return;
    }
    // 도달 가능하지만 아직 online 미확정 → 수신 시도(성공해야 online 확정 = 실패 시 다음 tick 재시도)
    if (!online) {
      console.log('[watcher] connectivity offline→online → 자동 수신 실행');
      const ok = await triggerReceive(localUrl);
      if (ok) online = true;
    }
  };

  // 기동 즉시 1회 + 주기 폴링
  void tick();
  setInterval(() => void tick(), pollMs);
}
