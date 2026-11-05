// lib/sync/softDeleteSchema.ts
// 소프트 삭제 컬럼(delete_yn) 보강 — 엣지/중앙 양 역할 모두에서 동작.
// 삭제가 물리 DELETE 대신 delete_yn='Y' 업데이트가 되면서, 기존 동기화가 그대로 전파한다.
// 컬럼만 보장하면 되므로 여기서는 DDL(ALTER)만 담당한다.
//
// 주의: ALTER TABLE 은 ACCESS EXCLUSIVE 락을 잡으므로, 이미 컬럼이 있으면 ALTER 자체를 발행하지
// 않는다(information_schema 로 선검사). PG11+ 에서 NOT NULL DEFAULT 상수 추가는 즉시(테이블
// 재작성 없음)지만, 안전하게 lock_timeout 을 둔다. 권한 부족(중앙) 등으로 실패해도 throw 하지 않고
// ok:false 를 반환해 호출부(부팅 로거)가 수동 마이그레이션 016 적용을 안내하게 한다.
import { withTransaction, query } from '@/db';
import { SOFT_DELETE_TABLES, clearColumnCache } from './upsert';

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

// 프로세스당 1회(성공 시) — 실패하면 플래그 미설정 → 다음 호출에 재시도.
const g = globalThis as unknown as { __pmsSoftDeleteReady?: boolean };

export type SoftDeleteResult = { ok: boolean; added: string[]; missing: string[]; message?: string };

async function tableExists(table: string): Promise<boolean> {
  const r = await query(
    `select 1 from information_schema.tables
       where table_schema = current_schema() and table_name = @t`,
    [{ name: 't', value: table }]
  );
  return r.length > 0;
}

async function columnExists(table: string): Promise<boolean> {
  const r = await query(
    `select 1 from information_schema.columns
       where table_schema = current_schema() and table_name = @t and column_name = 'delete_yn'`,
    [{ name: 't', value: table }]
  );
  return r.length > 0;
}

/**
 * soft-delete 대상 테이블에 delete_yn 컬럼이 없으면 추가한다. 양 역할에서 안전.
 * never throws. 실패 시 ok:false + DB 메시지 + 로그 1줄(수동 016 안내).
 */
export async function ensureSoftDeleteColumns(): Promise<SoftDeleteResult> {
  if (g.__pmsSoftDeleteReady) return { ok: true, added: [], missing: [] };

  const added: string[] = [];
  const missing: string[] = [];
  let failMsg: string | undefined;

  try {
    // 1) 추가가 필요한 테이블만 선별(존재하고, 컬럼이 아직 없는 것). 이미 있으면 ALTER 안 함(락 회피)
    const toAdd: string[] = [];
    for (const t of SOFT_DELETE_TABLES) {
      if (!(await tableExists(t))) continue;       // 테이블 자체가 없음 → 대상 아님
      if (await columnExists(t)) continue;          // 이미 있음 → ALTER 생략
      toAdd.push(t);
    }

    // 2) 테이블별 개별 트랜잭션으로 ALTER(한 테이블 실패가 다른 테이블 성공을 되돌리지 않도록)
    for (const t of toAdd) {
      try {
        await withTransaction(async (client) => {
          await client.query("SET LOCAL lock_timeout = '5s'");
          await client.query(
            `ALTER TABLE ${q(t)} ADD COLUMN IF NOT EXISTS delete_yn character(1) NOT NULL DEFAULT 'N'`
          );
        });
        added.push(t);
      } catch (err) {
        failMsg = (err as Error).message;
        missing.push(t);
      }
    }
  } catch (err) {
    // 선검사 자체가 실패(연결 불가 등) — 전부 미확정
    failMsg = (err as Error).message;
  }

  clearColumnCache(); // 컬럼 캐시 무효화(새 컬럼 반영)

  if (failMsg) {
    console.error(
      `[schema] soft-delete 컬럼 추가 실패: ${failMsg} — 중앙 DB에 수동 마이그레이션 migration/sql/016_soft_delete_flag.sql 을 적용하세요.`
    );
    return { ok: false, added, missing, message: failMsg };
  }

  g.__pmsSoftDeleteReady = true;
  return { ok: true, added, missing: [] };
}

/** 각 soft-delete 테이블의 delete_yn 컬럼 보유 여부(조회만, 변경 없음). */
export async function getSoftDeleteStatus(): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const t of SOFT_DELETE_TABLES) {
    try {
      out[t] = (await tableExists(t)) ? await columnExists(t) : false;
    } catch {
      out[t] = false;
    }
  }
  return out;
}
