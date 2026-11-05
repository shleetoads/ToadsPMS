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

// 테이블별 실제 컬럼 집합 캐시. 중앙/엣지 스키마 드리프트(한쪽에만 있는 컬럼) 허용 및
// 존재하지 않는 테이블 스킵 판정에 쓴다. 비어있는(=테이블 없음) 결과는 캐시하지 않는다.
const columnCache = new Map<string, Set<string>>();
// 존재하지 않는 테이블 경고 중복 방지(프로세스당 1회).
const missingWarned = new Set<string>();

/**
 * 테이블의 실제 컬럼 집합을 조회(현재 스키마 기준). 결과는 모듈 캐시.
 * 빈 집합 == 로컬에 해당 테이블 없음.
 */
export async function getTableColumns(client: PoolClient, table: string): Promise<Set<string>> {
  const cached = columnCache.get(table);
  if (cached) return cached;
  const r = await client.query<{ column_name: string }>(
    `select column_name from information_schema.columns
       where table_schema = current_schema() and table_name = $1`,
    [table]
  );
  const set = new Set(r.rows.map((x) => x.column_name));
  if (set.size > 0) columnCache.set(table, set); // 비어있는 결과(테이블 없음)는 캐시 안 함
  return set;
}

/** 로컬 테이블이 특정 컬럼을 가지고 있는지 */
export async function tableHasColumn(client: PoolClient, table: string, column: string): Promise<boolean> {
  const cols = await getTableColumns(client, table);
  return cols.has(column);
}

/** DDL(엣지 스키마 보강 등)로 컬럼이 바뀐 뒤 캐시를 비워 새 컬럼이 반영되게 한다. */
export function clearColumnCache(): void {
  columnCache.clear();
}

// 소프트 삭제(delete_yn='Y') 대상 테이블. 삭제는 물리 삭제가 아니라 일반 UPDATE 이므로
// 기존 동기화(select * + 컬럼 교집합 upsert)가 그대로 전파한다 — 별도 처리 불필요.
// vessel/"user" 의 기존 delete_yn 관례와 동일. (현재 단계 대상: warehouse/material/receive)
export const SOFT_DELETE_TABLES: readonly string[] = ['warehouse', 'material', 'receive'];

export type UpsertOptions = {
  /** 갱신 시 last_receive_date=now() 세팅(해당 컬럼 보유 테이블만 적용) */
  stampReceiveDate?: boolean;
  /** GENERATED ALWAYS AS IDENTITY 컬럼 명시값 삽입(예: tenant.tenant_no) */
  overriding?: boolean;
  /** true면 ON CONFLICT DO NOTHING — 기존 행을 절대 덮어쓰지 않음(공유 마스터 보호) */
  insertOnly?: boolean;
  /**
   * true면 '아직 중앙에 보내지 않은' 로컬 변경을 다운로드가 덮지 않도록 보호.
   * (change_seq·sent_seq 둘 다 있는 테이블에만 적용)
   */
  guardUnsent?: boolean;
};

/**
 * rows 를 table 에 PK 기준으로 upsert.
 * - change_seq / sent_seq 는 항상 제거(수신측은 자기 시퀀스를 트리거로 부여, sent_seq 는 로컬 전용).
 * - 로컬에 없는 컬럼은 페이로드에서 제거(스키마 드리프트 허용).
 * - 로컬에 테이블 자체가 없으면 스킵하고 0 반환(경고 1회).
 * @returns 영향 행 수
 */
export async function upsertRows(
  client: PoolClient,
  table: string,
  pkCols: string[],
  rows: any[] | undefined,
  opts: UpsertOptions = {}
): Promise<number> {
  if (!rows || rows.length === 0) return 0;

  // 로컬 컬럼 집합 — 비어있으면 테이블이 없는 것 → 스킵(스키마 드리프트/미생성 테이블 내성)
  const localCols = await getTableColumns(client, table);
  if (localCols.size === 0) {
    if (!missingWarned.has(table)) {
      missingWarned.add(table);
      console.warn(`[sync/upsert] 로컬에 '${table}' 테이블이 없어 적용을 건너뜁니다.`);
    }
    return 0;
  }

  const hasReceiveDate = localCols.has('last_receive_date');
  const hasChangeSeq = localCols.has('change_seq');
  const hasSentSeq = localCols.has('sent_seq');
  const stamp = opts.stampReceiveDate === true && hasReceiveDate;
  const guardUnsent = opts.guardUnsent === true && hasChangeSeq && hasSentSeq;
  const ov = opts.overriding ? 'OVERRIDING SYSTEM VALUE ' : '';

  let affected = 0;
  for (const row of rows) {
    // change_seq/sent_seq 제거 + 로컬에 없는 컬럼 제거(양방향 스키마 드리프트 허용)
    const cols = Object.keys(row).filter(
      (k) => k !== 'change_seq' && k !== 'sent_seq' && row[k] !== undefined && localCols.has(k)
    );
    if (cols.length === 0) continue;

    const values = cols.map((c) => reviveValue(row[c]));
    const colList = cols.map(q).join(', ');
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const conflictTarget = pkCols.map(q).join(', ');
    const nonPk = cols.filter((c) => !pkCols.includes(c));

    let sql: string;
    if (opts.insertOnly || nonPk.length === 0) {
      // insertOnly: 기존 행 보존(공유 마스터). nonPk 없음: 갱신할 컬럼 없음.
      sql = `INSERT INTO ${q(table)} (${colList}) ${ov}VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO NOTHING`;
    } else {
      const setParts = nonPk.map((c) => `${q(c)} = EXCLUDED.${q(c)}`);
      if (stamp) setParts.push(`"last_receive_date" = now()::timestamp`);
      sql = `INSERT INTO ${q(table)} (${colList}) ${ov}VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO UPDATE SET ${setParts.join(', ')}`;

      // 실제로 값이 바뀔 때만 UPDATE 하도록 조건을 건다.
      // 이유: 중앙이 매번 전량으로 돌려주는 테이블(machine/equipment_runtime/material_*)이나
      // 업로드 직후 에코된 행은 내용이 같아도 멱등 upsert가 rowCount 1을 돌려줘
      // "받음 N건"이 매 동기화마다 부풀고 화면이 불필요하게 새로고침된다. 또한 무의미한 쓰기도 피한다.
      // nonPk 컬럼(= SET 대상, last_receive_date 스탬프 제외) 중 하나라도 달라야 갱신.
      const distinct = `ROW(${nonPk.map((c) => `${q(table)}.${q(c)}`).join(', ')}) IS DISTINCT FROM ROW(${nonPk.map((c) => `EXCLUDED.${q(c)}`).join(', ')})`;
      if (guardUnsent) {
        // 추가로, 아직 중앙에 전송하지 않은 로컬 변경은 덮지 않는다.
        // change_seq 가 NULL(시드/수신행) 이거나, 마지막 전송분(sent_seq)과 현재 change_seq 가
        // 같은(=미전송 변경 없음) 행만 갱신 허용. (값 바인딩 불필요 — 컬럼 간 비교)
        sql += ` WHERE ${distinct} AND (${q(table)}.${q('change_seq')} IS NULL OR ${q(table)}.${q('sent_seq')} IS NOT DISTINCT FROM ${q(table)}.${q('change_seq')})`;
      } else {
        sql += ` WHERE ${distinct}`;
      }
    }

    const r = await client.query(sql, values);
    affected += r.rowCount ?? 0;
  }
  return affected;
}

// ─────────────────────────────────────────────────────────────────────────────
// 테이블 매핑
// ─────────────────────────────────────────────────────────────────────────────

// 업로드 (엣지 → 중앙) → (테이블, PK) 매핑. FK 의존성 순서(부모 먼저).
export const UPLOAD_TABLE_MAP: Array<{ table: string; pk: string[] }> = [
  { table: 'machine',               pk: ['vessel_no', 'machine_name'] },
  { table: 'equipment',             pk: ['equip_no', 'vessel_no', 'machine_name'] },
  { table: 'equipment_runtime',     pk: ['vessel_no', 'machine_name', 'equip_no'] },
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

// 스코프: 'global'(전역, 필터 없음) | 'vessel'(vessel_no=:v) | 'ship_no'(user: ship_no=:v)
export type DownloadScope = 'global' | 'vessel' | 'ship_no';

// 다운로드 (중앙 → 엣지) → (테이블, PK, scope) 매핑. FK 의존성 순서(부모 먼저).
// shared: 문서(document) 프로젝트가 소유해 같은 DB를 공유하는 테이블 — 엣지에서 덮어쓰지 않음.
export const DOWNLOAD_TABLE_MAP: Array<{
  table: string;
  pk: string[];
  scope: DownloadScope;
  shared?: boolean;
  overriding?: boolean;
}> = [
  { table: 'tenant',        pk: ['tenant_no'],  scope: 'global',  shared: true, overriding: true }, // tenant_no=IDENTITY
  { table: 'vessel',        pk: ['vessel_no'],  scope: 'vessel',  shared: true },
  { table: 'user',          pk: ['account_no'], scope: 'ship_no', shared: true },
  { table: 'material_type', pk: ['code'],       scope: 'global' },
  { table: 'material_unit', pk: ['code'],       scope: 'global' },
  // 이하 UPLOAD 테이블 전부(동일 순서) — vessel 스코프
  { table: 'machine',               pk: ['vessel_no', 'machine_name'],                                      scope: 'vessel' },
  { table: 'equipment',             pk: ['equip_no', 'vessel_no', 'machine_name'],                          scope: 'vessel' },
  { table: 'equipment_runtime',     pk: ['vessel_no', 'machine_name', 'equip_no'],                          scope: 'vessel' },
  { table: 'section',               pk: ['equip_no', 'section_code', 'vessel_no'],                          scope: 'vessel' },
  { table: 'maintenance_plan',      pk: ['equip_no', 'section_code', 'plan_code', 'vessel_no'],             scope: 'vessel' },
  { table: 'maintenance_extension', pk: ['equip_no', 'section_code', 'plan_code', 'vessel_no', 'extension_seq'], scope: 'vessel' },
  { table: 'warehouse',             pk: ['vessel_no', 'warehouse_no'],                                      scope: 'vessel' },
  { table: 'material',              pk: ['vessel_no', 'material_code'],                                     scope: 'vessel' },
  { table: 'maintenance_work',      pk: ['vessel_no', 'work_order'],                                        scope: 'vessel' },
  { table: 'used_parts',            pk: ['vessel_no', 'work_order', 'part_seq'],                            scope: 'vessel' },
  { table: 'receive',               pk: ['receive_no', 'vessel_no'],                                        scope: 'vessel' },
  { table: 'release',               pk: ['vessel_no', 'release_no'],                                        scope: 'vessel' },
  { table: 'loss',                  pk: ['vessel_no', 'loss_no'],                                           scope: 'vessel' },
];

// 중앙 /api/data/all/get 응답 배열 → (테이블, PK) 매핑 (레거시 수신 경로 유지).
export const RECEIVE_TABLE_MAP: Array<{ key: string; table: string; pk: string[] }> = [
  { key: 'vessels',      table: 'vessel',                pk: ['vessel_no'] },
  { key: 'equipments',   table: 'equipment',             pk: ['equip_no', 'vessel_no', 'machine_name'] },
  { key: 'sections',     table: 'section',               pk: ['equip_no', 'section_code', 'vessel_no'] },
  { key: 'maintenances', table: 'maintenance_plan',      pk: ['equip_no', 'section_code', 'plan_code', 'vessel_no'] },
  { key: 'extensions',   table: 'maintenance_extension', pk: ['equip_no', 'section_code', 'plan_code', 'vessel_no', 'extension_seq'] },
  { key: 'materials',    table: 'material',              pk: ['vessel_no', 'material_code'] },
  { key: 'receives',     table: 'receive',               pk: ['receive_no', 'vessel_no'] },
];

// 온보딩 전체 시드 (/api/sync/seed 응답) → (테이블, PK) 매핑 (레거시 시드 경로 유지).
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
