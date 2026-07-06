import { NextResponse } from 'next/server';
import { query } from '@/db';

// 중앙 헬스체크 — 엣지 회선 감지 감시자(§8)와 배포 스모크에 사용.
// DB ping 1회. 짧게 실패시켜(연결 타임아웃, GAP-7) 감시자가 offline 판정 가능.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await query('select 1 as ok');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[health] db ping failed:', (err as Error).message);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
