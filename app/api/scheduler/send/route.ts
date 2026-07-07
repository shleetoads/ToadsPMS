import { NextResponse } from 'next/server';
import { runSend } from '@/lib/sync/send';

// 엣지 → 중앙 업로드 트리거.
// 실제 로직은 lib/sync/send.ts (change_seq 델타 → /api/sync/upload).
// 구 MSSQL MERGE 기반 send 를 대체(F1).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const remoteSiteUrl = process.env.REMOTE_SITE_URL;
  const vesselNo = process.env.VESSEL ?? '';
  const token = process.env.NODE_TOKEN;

  if (!remoteSiteUrl) {
    return NextResponse.json({ success: false, message: 'REMOTE_SITE_URL not set' }, { status: 400 });
  }
  if (!vesselNo) {
    return NextResponse.json({ success: false, message: 'VESSEL not set' }, { status: 400 });
  }

  try {
    const { total, sentSeq, counts } = await runSend({ remoteSiteUrl, vesselNo, token });
    return NextResponse.json({ success: true, vessel_no: vesselNo, total, sentSeq, counts });
  } catch (err) {
    console.error('[scheduler/send]', err);
    const msg = (err as Error).message || 'Server error';
    const status = msg.startsWith('remote upload failed') ? 502 : 500;
    return NextResponse.json({ success: false, message: msg }, { status });
  }
}
