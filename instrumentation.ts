// instrumentation.ts
// 서버 시작 시 1회 호출된다(Next.js 15 stable).
// 엣지 노드에서 회선 감지 감시자(watcher)를 기동한다.
// 설계: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §8 (D5)

export async function register() {
  // register()는 nodejs/edge 양 런타임에서 호출됨.
  // db(pg)·dotenv는 node 전용이므로 nodejs 런타임에서만 import (Edge 컴파일 'path' 오류 방지).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // 중앙(central)에서는 감시자 미기동. 엣지에서 SYNC_WATCHER=on 일 때만.
  if (process.env.SYNC_WATCHER === 'on' && process.env.NODE_ROLE !== 'central') {
    const { startWatcher } = await import('@/lib/sync/watcher');
    startWatcher();
  }
}
