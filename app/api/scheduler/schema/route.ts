import { NextResponse } from 'next/server';
import { ensureSoftDeleteColumns, getSoftDeleteStatus } from '@/lib/sync/softDeleteSchema';
import { ensureEdgeSyncSchema } from '@/lib/sync/edgeSchema';
import { isEdge } from '@/lib/sync/engine';

// 스키마 보강 엔드포인트(양 역할).
//   GET  → 현재 soft-delete 컬럼 보유 현황(변경 없음).
//   POST → ensureSoftDeleteColumns() 실행(+엣지면 ensureEdgeSyncSchema()).
// 절대 500 을 내지 않는다 — 실패해도 status 200 + { success:false, message } 로 돌려
// 부팅 트리거(schemaBoot)가 로그만 남기고 넘어갈 수 있게 한다.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function roleOf(): 'edge' | 'central' {
  return process.env.NODE_ROLE === 'central' ? 'central' : 'edge';
}

export async function GET() {
  const softDelete = await getSoftDeleteStatus();
  return NextResponse.json({ role: roleOf(), softDelete });
}

export async function POST() {
  const role = roleOf();

  // soft-delete 컬럼 보강(never throws)
  const soft = await ensureSoftDeleteColumns();

  // 엣지면 동기화 스키마도 함께 보강(시퀀스/트리거/change_seq·sent_seq/sync_state)
  let edgeOk = true;
  let edgeMsg: string | undefined;
  if (isEdge()) {
    try {
      await ensureEdgeSyncSchema();
    } catch (err) {
      edgeOk = false;
      edgeMsg = (err as Error).message;
    }
  }

  const success = soft.ok && edgeOk;
  const message = !soft.ok ? soft.message : edgeMsg;
  return NextResponse.json(
    { success, role, added: soft.added, missing: soft.missing, edge: isEdge(), message },
    { status: 200 }
  );
}
