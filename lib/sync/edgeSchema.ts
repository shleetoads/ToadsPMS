// lib/sync/edgeSchema.ts
// 엣지(선박) 전용: 동기화에 필요한 스키마(시퀀스/트리거 함수/change_seq·sent_seq 컬럼/인덱스/
// 트리거/sync_state)를 '가법적·멱등'으로 보강한다. 선상 DB 는 문서(document) 프로젝트와 공유하므로
// 자기 소유(UPLOAD_TABLE_MAP) 테이블만 건드리고, 기존 행의 change_seq 는 절대 백필하지 않는다.
// 설계: migration/sql/011_sync_change_seq.sql, 013_sync_state.sql 미러(선상 적용).
import { withTransaction } from '@/db';
import { UPLOAD_TABLE_MAP, clearColumnCache } from './upsert';
import { isEdge } from './engine';
import { ensureSoftDeleteColumns } from './softDeleteSchema';
import type { PoolClient } from 'pg';

// 프로세스당 1회(성공 시) — 실패하면 플래그를 세우지 않아 다음 회차에 재시도.
const g = globalThis as unknown as { __pmsEdgeSchemaReady?: boolean };

// 011 과 동일한 트리거 함수 본문: 수신 적용 중(app.sync_apply='on')엔 미부여(에코 차단, F2).
const SET_CHANGE_SEQ_FN = `
CREATE OR REPLACE FUNCTION set_change_seq() RETURNS trigger AS $fn$
BEGIN
  IF current_setting('app.sync_apply', true) = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.change_seq := nextval('pms_change_seq');
  RETURN NEW;
END $fn$ LANGUAGE plpgsql;`;

async function tableExists(client: PoolClient, t: string): Promise<boolean> {
  const r = await client.query(
    `select 1 from information_schema.tables where table_schema = current_schema() and table_name = $1`,
    [t]
  );
  return (r.rowCount ?? 0) > 0;
}

async function triggerExists(client: PoolClient, table: string, trg: string): Promise<boolean> {
  const r = await client.query(
    `select 1 from pg_trigger tr join pg_class c on c.oid = tr.tgrelid
       where tr.tgname = $1 and c.relname = $2 and not tr.tgisinternal`,
    [trg, table]
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * 엣지 동기화 스키마 보강. runSyncOnce 시작부(try 안)에서 호출 → 실패 시 동기화 실패로 보고.
 * 멱등·가법적. 중앙에서는 no-op.
 */
export async function ensureEdgeSyncSchema(): Promise<void> {
  if (!isEdge()) return;
  // soft-delete 컬럼도 함께 보강(멱등·자체 플래그) → 엣지는 한 번 호출로 스키마 완결.
  await ensureSoftDeleteColumns();
  if (g.__pmsEdgeSchemaReady) return;

  let ensured = 0;
  await withTransaction(async (client) => {
    // 1) 시퀀스 + 트리거 함수
    await client.query(`CREATE SEQUENCE IF NOT EXISTS pms_change_seq`);
    await client.query(SET_CHANGE_SEQ_FN);

    // 2) 존재하는 업로드 테이블에만 컬럼/인덱스/트리거 보강(기존 행 백필 없음)
    const existing: string[] = [];
    for (const { table } of UPLOAD_TABLE_MAP) {
      if (!(await tableExists(client, table))) continue; // 미생성 업무 테이블은 스킵(비치명적)
      existing.push(table);

      await client.query(`ALTER TABLE ${qi(table)} ADD COLUMN IF NOT EXISTS change_seq bigint`);
      await client.query(`ALTER TABLE ${qi(table)} ADD COLUMN IF NOT EXISTS sent_seq bigint`);
      await client.query(`CREATE INDEX IF NOT EXISTS ${qi('ix_' + table + '_change_seq')} ON ${qi(table)} (change_seq)`);

      const trg = `trg_${table}_change_seq`;
      if (!(await triggerExists(client, table, trg))) {
        // 이미 있는 트리거는 drop/recreate 하지 않는다(문서 프로젝트 소유 가능성).
        await client.query(
          `CREATE TRIGGER ${qi(trg)} BEFORE INSERT OR UPDATE ON ${qi(table)}
             FOR EACH ROW EXECUTE FUNCTION set_change_seq()`
        );
      }
      ensured++;
    }

    if (existing.length === 0) {
      // 하나도 없으면 PMS 테이블 자체가 미생성 → 사용자에게 안내(동기화 실패로 노출됨)
      throw new Error('PMS 테이블이 없습니다. 먼저 PMS 테이블 생성 SQL을 실행하세요.');
    }

    // 3) sync_state (013 미러) + 초기 커서
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_state (
        peer            text NOT NULL,
        direction       text NOT NULL,
        last_seq        bigint NOT NULL DEFAULT 0,
        last_success_at timestamp,
        PRIMARY KEY (peer, direction)
      )`);
    await client.query(
      `INSERT INTO sync_state (peer, direction, last_seq)
         VALUES ('central','upload',0), ('central','download',0)
       ON CONFLICT (peer, direction) DO NOTHING`
    );

    // 4) 구 워터마크 → sent_seq 1회 이관: upload.last_seq>0 이면 그 이하 change_seq 는
    //    이미 업로드된 것으로 보고 sent_seq 를 맞춰 재전송을 막는다. last_seq=0 이면 아무것도 안 함.
    const upRows = await client.query<{ last_seq: string }>(
      `select last_seq from sync_state where peer='central' and direction='upload'`
    );
    const oldCursor = upRows.rows.length ? Number(upRows.rows[0].last_seq) : 0;
    if (oldCursor > 0) {
      await client.query("SET LOCAL app.sync_apply = 'on'"); // 표시 UPDATE 가 새 변경으로 잡히지 않도록
      for (const table of existing) {
        await client.query(
          `UPDATE ${qi(table)} SET sent_seq = change_seq
             WHERE change_seq IS NOT NULL AND change_seq <= $1 AND sent_seq IS NULL`,
          [oldCursor]
        );
      }
    }
  });

  // 5) 새 컬럼이 upsert 캐시에 반영되도록 비우고 성공 표시
  clearColumnCache();
  g.__pmsEdgeSchemaReady = true;
  console.log(`[sync] edge sync schema ensured (${ensured} tables)`);
}

// 식별자 인용(예약어/대소문자 안전)
function qi(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}
