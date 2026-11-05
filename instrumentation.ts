// instrumentation.ts
// 서버 시작 시 1회 호출된다(Next.js 15 stable).
// - 양 역할(엣지/중앙): 부팅 직후 스키마 보강(soft-delete 컬럼 등)을 로컬 HTTP로 트리거.
// - 엣지 노드: 동기화 감시자(watcher) 기동.
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §8 (D5)

export async function register() {
  // register()는 nodejs/edge 양 런타임에서 호출됨.
  // db(pg)·dotenv는 node 전용이므로 nodejs 런타임에서만 import (Edge 컴파일 'path' 오류 방지).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // 양 역할 공통: soft-delete 컬럼(+엣지면 동기화 스키마) 보강을 로컬 엔드포인트로 트리거.
  // schemaBoot 는 pg 를 import 하지 않으므로 instrumentation 번들에 안전.
  const { startSchemaEnsure } = await import('@/lib/sync/schemaBoot');
  startSchemaEnsure();

  // 중앙(central)에서는 감시자 미기동. 엣지에서 SYNC_WATCHER=on 일 때만.
  if (process.env.SYNC_WATCHER === 'on' && process.env.NODE_ROLE !== 'central') {
    const { startWatcher } = await import('@/lib/sync/watcher');
    startWatcher();
  }
}
