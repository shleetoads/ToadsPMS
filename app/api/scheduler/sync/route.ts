import { NextResponse } from 'next/server';
import { getSyncStatus, runSyncOnce, isEdge } from '@/lib/sync/engine';

// 엣지 동기화 단일 엔드포인트.
//   GET  → 현재 상태(getSyncStatus). 중앙이면 { edge:false }.
//   POST → 1회 동기화 실행(업로드→다운로드). ?trigger=auto|manual(기본 manual), ?full=1 전량.
// watcher(auto)와 헤더 버튼(manual)이 공용.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await getSyncStatus();
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  if (!isEdge()) {
    return NextResponse.json(
      { success: false, message: '이 서버는 선박(엣지) 서버가 아닙니다.' },
      { status: 400 }
    );
  }

  const sp = new URL(req.url).searchParams;
  const trigger = sp.get('trigger') === 'auto' ? 'auto' : 'manual';
  const full = sp.get('full') === '1';

  const r = await runSyncOnce(trigger, { full });

  if (r.busy) {
    return NextResponse.json({ success: false, message: r.message }, { status: 409 });
  }
  if (!r.ok) {
    return NextResponse.json({ success: false, message: r.message }, { status: 502 });
  }
  return NextResponse.json({
    success: true,
    uploaded: r.uploaded,
    downloaded: r.downloaded,
    mode: r.mode,
    message: '동기화 완료',
    last: r.last,
  });
}
