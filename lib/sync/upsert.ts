// lib/sync/upsert.ts
// 선상 엣지 ↔ 중앙 동기화: PostgreSQL 네이티브 멱등 upsert 헬퍼
// 설계 근거: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.4 (F1: MSSQL MERGE 금지)
//
// 자연키(PK) 기준 INSERT ... ON CONFLICT DO UPDATE. 재전송 멱등.
// 수신 적용은 반드시 트랜잭션에서 `SET LOCAL app.sync_apply='on'` 후 호출(에코 차단, F2).
import { PoolClient } from 'pg';

// 식별자 인용(예약어 "user"/"release" 및 대소문자 안전)
const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

// bytea(예: user.password)는 pg가 Buffer로 주는데, JSON 왕복 시
// {type:'Buffer', data:[...]} 로 직렬화된다. 삽입 전에 다시 Buffer로 복원.
function reviveValue(v: any): any {
  if (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data)) {
    return Buffer.from(v.data);
  }
  return v;
}

/**
 * rows 를 table 에 PK 기준으로 upsert.
 * @param stampReceiveDate true면 갱신 시 last_receive_date=now() 도 세팅(해당 컬럼 보유 테이블만).
 * @returns 영향 행 수
 */
export async function upsertRows(
  client: PoolClient,
  table: string,
  pkCols: string[],
  rows: any[] | undefined,
  stampReceiveDate = true,
  overriding = false // GENERATED ALWAYS AS IDENTITY 컬럼(예: tenant.tenant_no) 명시값 삽입용
): Promise<number> {
  if (!rows || rows.length === 0) return 0;
  let affected = 0;
  const ov = overriding ? 'OVERRIDING SYSTEM VALUE ' : '';

  for (const row of rows) {
    const cols = Object.keys(row).filter((k) => row[k] !== undefined);
    if (cols.length === 0) continue;

    const values = cols.map((c) => reviveValue(row[c]));
    const colList = cols.map(q).join(', ');
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const conflictTarget = pkCols.map(q).join(', ');

    const nonPk = cols.filter((c) => !pkCols.includes(c));
    let sql: string;
    if (nonPk.length === 0) {
      sql = `INSERT INTO ${q(table)} (${colList}) ${ov}VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO NOTHING`;
    } else {
      const setParts = nonPk.map((c) => `${q(c)} = EXCLUDED.${q(c)}`);
      if (stampReceiveDate) setParts.push(`"last_receive_date" = now()::timestamp`);
      sql = `INSERT INTO ${q(table)} (${colList}) ${ov}VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO UPDATE SET ${setParts.join(', ')}`;
    }

    const r = await client.query(sql, values);
    affected += r.rowCount ?? 0;
  }
  return affected;
}

// 중앙 /api/data/all/get 응답 배열 → (테이블, PK) 매핑 (평상시 수신: 다운로드 마스터)
export const RECEIVE_TABLE_MAP: Array<{ key: string; table: string; pk: string[] }> = [
  { key: 'vessels',      table: 'vessel',                pk: ['vessel_no'] },
  { key: 'equipments',   table: 'equipment',             pk: ['equip_no', 'vessel_no', 'machine_name'] },
  { key: 'sections',     table: 'section',               pk: ['equip_no', 'section_code', 'vessel_no'] },
  { key: 'maintenances', table: 'maintenance_plan',      pk: ['equip_no', 'section_code', 'plan_code', 'vessel_no'] },
  { key: 'extensions',   table: 'maintenance_extension', pk: ['equip_no', 'section_code', 'plan_code', 'vessel_no', 'extension_seq'] },
  { key: 'materials',    table: 'material',              pk: ['vessel_no', 'material_code'] },
  { key: 'receives',     table: 'receive',               pk: ['receive_no', 'vessel_no'] },
];

// 업로드 (엣지 → 중앙) → (테이블, PK) 매핑.
// 업로드-소유(이력) + 양방향 마스터. bundle 키 == 테이블명.
export const UPLOAD_TABLE_MAP: Array<{ table: string; pk: string[] }> = [
  { table: 'maintenance_work',      pk: ['vessel_no', 'work_order'] },
  { table: 'used_parts',            pk: ['vessel_no', 'work_order', 'part_seq'] },
  { table: 'receive',               pk: ['receive_no', 'vessel_no'] },
  { table: 'release',               pk: ['vessel_no', 'release_no'] },
  { table: 'loss',                  pk: ['vessel_no', 'loss_no'] },
  { table: 'equipment',             pk: ['equip_no', 'vessel_no', 'machine_name'] },
  { table: 'section',               pk: ['equip_no', 'section_code', 'vessel_no'] },
  { table: 'material',              pk: ['vessel_no', 'material_code'] },
  { table: 'warehouse',             pk: ['vessel_no', 'warehouse_no'] },
  { table: 'maintenance_extension', pk: ['equip_no', 'section_code', 'plan_code', 'vessel_no', 'extension_seq'] },
];

// 온보딩 전체 시드 (/api/sync/seed 응답) → (테이블, PK) 매핑.
// bundle 키 == 테이블명. 마스터 + 이력 + machine + user 전부.
// 적용 순서 = FK 의존성 순서(부모 먼저).
export const SEED_TABLE_MAP: Array<{ table: string; pk: string[]; overriding?: boolean }> = [
  { table: 'tenant',                pk: ['tenant_no'], overriding: true },   // 전역 참조(user FK). tenant_no=IDENTITY. user 앞.
  { table: 'vessel',                pk: ['vessel_no'] },
  { table: 'user',                  pk: ['account_no'] },
  { table: 'machine',               pk: ['vessel_no', 'machine_name'] },
  { table: 'equipment',             pk: ['equip_no', 'vessel_no', 'machine_name'] },
  { table: 'section',               pk: ['equip_no', 'section_code', 'vessel_no'] },
  { table: 'maintenance_plan',      pk: ['equip_no', 'section_code', 'plan_code', 'vessel_no'] },
  { table: 'maintenance_extension', pk: ['equip_no', 'section_code', 'plan_code', 'vessel_no', 'extension_seq'] },
  { table: 'warehouse',             pk: ['vessel_no', 'warehouse_no'] },
  { table: 'material',              pk: ['vessel_no', 'material_code'] },
  { table: 'maintenance_work',      pk: ['vessel_no', 'work_order'] },
  { table: 'used_parts',            pk: ['vessel_no', 'work_order', 'part_seq'] },
  { table: 'receive',               pk: ['receive_no', 'vessel_no'] },
  { table: 'release',               pk: ['vessel_no', 'release_no'] },
  { table: 'loss',                  pk: ['vessel_no', 'loss_no'] },
];
