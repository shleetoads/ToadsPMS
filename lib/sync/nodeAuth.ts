// lib/sync/nodeAuth.ts
// 선상 엣지 ↔ 중앙 동기화: 노드 토큰 인증 게이트웨이 (핸들러 기반, R3)
// 설계 근거: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §5 (D2, NFR-2)
//
// 사용법(각 /api/sync/* 핸들러 진입부):
//   const auth = await verifyNode(req);
//   if (!auth.ok) return NextResponse.json({ success:false, message:auth.message }, { status:auth.status });
//   // auth.node.vesselNo 로 페이로드 vessel 일치 강제
import { createHash } from 'crypto';
import { query, execute } from '@/db';

export type NodeIdentity = { nodeId: string; vesselNo: string };
export type VerifyResult =
  | { ok: true; node: NodeIdentity }
  | { ok: false; status: number; message: string };

/** 토큰 원문 → sha256 (DB의 token_hash bytea 와 비교) */
export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/**
 * 요청의 노드 토큰을 검증한다.
 * - NODE_ROLE !== 'central' (엣지 자기자신 로컬 호출) → 통과.
 * - Bearer 토큰 없음/불일치/정지 노드 → 401.
 * - X-Vessel-No 가 노드 소유 선박과 다르면 → 403.
 */
export async function verifyNode(req: Request): Promise<VerifyResult> {
  // 엣지 로컬 호출은 인증 불필요(게이트웨이는 중앙에서만 강제)
  if (process.env.NODE_ROLE !== 'central') {
    return { ok: true, node: { nodeId: 'local', vesselNo: process.env.VESSEL ?? '' } };
  }

  const authz = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(authz.trim());
  if (!m) {
    return { ok: false, status: 401, message: 'Missing bearer token' };
  }
  const token = m[1].trim();
  const tokenHash = hashToken(token);

  const rows = await query<{ node_id: string; vessel_no: string }>(
    `select node_id, vessel_no
       from sync_node
      where token_hash = @tokenHash
        and status = 'A'`,
    [{ name: 'tokenHash', value: tokenHash }]
  );

  if (rows.length === 0) {
    return { ok: false, status: 401, message: 'Invalid or suspended node token' };
  }

  const node: NodeIdentity = { nodeId: rows[0].node_id, vesselNo: rows[0].vessel_no };

  // 헤더의 선언 vessel 이 노드 소유 vessel 과 일치해야 함
  const headerVessel = req.headers.get('x-vessel-no');
  if (headerVessel && headerVessel !== node.vesselNo) {
    return { ok: false, status: 403, message: 'Vessel mismatch for node' };
  }

  // last_seen_at 갱신(실패해도 인증 자체는 통과)
  try {
    await execute(
      `update sync_node set last_seen_at = now()::timestamp where node_id = @nodeId`,
      [{ name: 'nodeId', value: node.nodeId }]
    );
  } catch (err) {
    console.error('[nodeAuth] last_seen_at update failed:', (err as Error).message);
  }

  return { ok: true, node };
}

/**
 * 페이로드의 모든 row.vessel_no 가 인증된 노드 vessel 과 일치하는지 강제.
 * 타 선박 데이터 주입 차단(GAP-3/6). 불일치 시 위반한 테이블명을 반환.
 */
export function findForeignVesselTable(
  rowsByTable: Record<string, Array<{ vessel_no?: string }>>,
  vesselNo: string
): string | null {
  for (const [table, rows] of Object.entries(rowsByTable ?? {})) {
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      // user 등 vessel_no 없는 테이블은 여기서 검증 제외(해당 핸들러에서 ship_no로 별도 처리)
      if (r?.vessel_no !== undefined && r.vessel_no !== vesselNo) {
        return table;
      }
    }
  }
  return null;
}
