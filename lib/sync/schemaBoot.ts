// lib/sync/schemaBoot.ts
// 부팅 직후 스키마 보강(soft-delete 컬럼 + 엣지 동기화 스키마)을 로컬 HTTP로 트리거한다.
//
// 중요: 이 모듈은 instrumentation 그래프에 포함되므로 @/db(pg) 를 직접 import 하지 않는다.
// 자기 프로세스의 HTTP 엔드포인트(/api/scheduler/schema)만 호출한다.

let started = false;

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** 연결 거부(로컬 서버 아직 미기동) 판별 */
function isConnRefused(err: any): boolean {
  const code = err?.cause?.code ?? err?.code;
  const msg = err?.message ?? '';
  return code === 'ECONNREFUSED' || /ECONNREFUSED|fetch failed/i.test(msg);
}

export function startSchemaEnsure(): void {
  if (started) return;
  started = true;

  const localUrl = `http://127.0.0.1:${process.env.PORT || 30001}`;

  const run = async () => {
    // 로컬 서버가 아직 리스닝 전(연결 거부)이면 3초 간격 최대 20회 재시도.
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(`${localUrl}/api/scheduler/schema`, { method: 'POST' });
        const j: any = await res.json().catch(() => ({}));
        if (j?.success) {
          const added = Array.isArray(j.added) && j.added.length ? j.added.join(', ') : '없음';
          console.log(`[schema] soft-delete columns ok (added: ${added})`);
        } else {
          console.error(
            `[schema] soft-delete 보강 실패: ${j?.message ?? `HTTP ${res.status}`} — 수동 마이그레이션 016 적용 필요`
          );
        }
        return;
      } catch (err) {
        if (isConnRefused(err) && attempt < 20) {
          await sleep(3000);
          continue;
        }
        console.error('[schema] 보강 호출 오류:', (err as Error).message);
        return;
      }
    }
  };

  setTimeout(() => void run(), 2000); // 첫 시도는 기동 ~2초 후
}
