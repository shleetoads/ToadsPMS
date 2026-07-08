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

/** 최초 온보딩(빈 DB면 자동 시드). 중앙 미지원/실패는 비치명적. */
async function triggerOnboard(localUrl: string): Promise<void> {
  try {
    const res = await fetch(`${localUrl}/api/scheduler/seed?ifEmpty=1`);
    const j: any = await res.json().catch(() => ({}));
    if (res.ok && j?.seeded) console.log(`[watcher] 최초 온보딩 시드 완료: total=${j.total}`);
    else if (!res.ok) console.error('[watcher] 온보딩 시드 실패(비치명적):', j?.message ?? `HTTP ${res.status}`);
  } catch (err) {
    console.error('[watcher] 온보딩 시드 건너뜀:', (err as Error).message);
  }
}

/** 온라인 전이 시: (빈 DB면)자동 온보딩 → 증분 수신. 수신 성공 여부 반환. */
async function triggerOnline(localUrl: string): Promise<boolean> {
  if (syncing) return false;
  syncing = true;
  try {
    await triggerOnboard(localUrl);            // 최초 1회만 실제 시드(ifEmpty)
    const res = await fetch(`${localUrl}/api/scheduler/receive`);
    const j: any = await res.json().catch(() => ({}));
    if (res.ok && j?.success) {
      console.log(`[watcher] receive ok: total=${j.total}`, j.counts);
      return true;
    }
    console.error('[watcher] receive failed:', j?.message ?? `HTTP ${res.status}`);
    return false;
  } catch (err) {
    console.error('[watcher] online 처리 오류:', (err as Error).message);
    return false;
  } finally {
    syncing = false;
  }
}

export function startWatcher(): void {
  if (started) return;

  const remote = process.env.REMOTE_SITE_URL;
  const vessel = process.env.VESSEL;
  // 자기 자신(같은 프로세스의 HTTP 서버)을 호출해야 하므로 항상 자기 PORT 사용.
  // (LOCAL_SITE_URL 은 중앙/다른 인스턴스를 가리킬 수 있어 신뢰 불가)
  const localUrl = `http://127.0.0.1:${process.env.PORT || 30001}`;
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
      console.log('[watcher] connectivity offline→online → 온보딩/수신 실행');
      const ok = await triggerOnline(localUrl);
      if (ok) online = true;
    }
  };

  // 기동 즉시 1회 + 주기 폴링
  void tick();
  setInterval(() => void tick(), pollMs);
}
