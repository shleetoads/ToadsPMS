import 'dotenv/config';
import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (!pool) {
    pool = new Pool({
      user: process.env.DB_USER!,
      password: process.env.DB_PASS!,
      host: process.env.DB_HOST!,
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME!,
      // RDS는 SSL 강제. 엣지 로컬 Postgres/로컬 개발은 SSL 미지원 → DB_SSL=false 로 비활성.
      // 운영(RDS) 승격 시 RDS CA 번들 검증으로 교체 예정.
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      // GAP-7: 회선 불안정한 선상/DB 도달 불가 시 60s 행 방지.
      // 연결 획득·유휴·질의 시간에 상한을 둬 빠르게 실패시킨다.
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 3000,
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
      statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 15000,
      max: Number(process.env.DB_POOL_MAX) || 10,
      keepAlive: true,
    });

    // 유휴 클라이언트 오류로 인한 프로세스 크래시 방지(로깅 후 계속).
    pool.on('error', (err) => {
      console.error('[db] idle client error:', err.message);
    });
  }
  return pool;
}

/** 이름 기반 파라미터 타입 */
export type NamedParam = { name: string; value: any };

/**
 * MSSQL의 @name 방식 파라미터를 PostgreSQL의 $N 방식으로 변환.
 * SQL에서 @paramName이 등장하는 순서대로 $1, $2, ... 로 치환.
 * 동일 이름 재등장 시 동일 $N 을 재사용한다.
 *
 * 반환은 { text, values } — pg 드라이버 `client.query(text, values)` 호출부에 그대로 전달 가능.
 */
export function adaptNamedParams(
  sql: string,
  params: NamedParam[]
): { text: string; values: any[] } {
  const seen: string[] = [];
  const text = sql.replace(/@(\w+)/g, (_, name) => {
    if (!seen.includes(name)) seen.push(name);
    return `$${seen.indexOf(name) + 1}`;
  });
  const values = seen.map(name => params.find(p => p.name === name)?.value);
  return { text, values };
}

/** 일반 SELECT / 단일 쿼리 */
export async function query<T = any>(
  queryString: string,
  params?: NamedParam[]
): Promise<T[]> {
  const p = await getPool();
  if (params && params.length > 0) {
    const { text, values } = adaptNamedParams(queryString, params);
    const result = await p.query<T>(text, values);
    return result.rows;
  }
  const result = await p.query<T>(queryString);
  return result.rows;
}

/** 일반 INSERT / UPDATE / DELETE */
export async function execute(
  queryString: string,
  params?: NamedParam[]
): Promise<number> {
  const p = await getPool();
  if (params && params.length > 0) {
    const { text, values } = adaptNamedParams(queryString, params);
    const result = await p.query(text, values);
    return result.rowCount ?? 0;
  }
  const result = await p.query(queryString);
  return result.rowCount ?? 0;
}

/** 트랜잭션 내 SELECT */
export async function queryWithClient<T = any>(
  client: PoolClient,
  queryString: string,
  params?: NamedParam[]
): Promise<T[]> {
  if (params && params.length > 0) {
    const { text, values } = adaptNamedParams(queryString, params);
    const result = await client.query<T>(text, values);
    return result.rows;
  }
  const result = await client.query<T>(queryString);
  return result.rows;
}

/** 트랜잭션 내 INSERT / UPDATE / DELETE */
export async function executeWithClient(
  client: PoolClient,
  queryString: string,
  params?: NamedParam[]
): Promise<number> {
  if (params && params.length > 0) {
    const { text, values } = adaptNamedParams(queryString, params);
    const result = await client.query(text, values);
    return result.rowCount ?? 0;
  }
  const result = await client.query(queryString);
  return result.rowCount ?? 0;
}

/**
 * 트랜잭션 래퍼
 * 사용 예:
 *   const count = await withTransaction(async (client) => {
 *     const { text, values } = adaptNamedParams(sql, params);
 *     const r = await client.query(text, values);
 *     return r.rowCount ?? 0;
 *   });
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const p = await getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
