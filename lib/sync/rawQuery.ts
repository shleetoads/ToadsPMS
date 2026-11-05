// lib/sync/rawQuery.ts
// 전송용 SELECT 전용 질의 헬퍼.
//
// WHY: pg 는 timestamp/date 류를 Node 프로세스의 TZ 기준 JS Date 로 파싱한다.
// 그 Date 를 JSON 으로 직렬화하면 UTC ISO 문자열이 되고, 수신측이 이를
// `timestamp without time zone` 컬럼에 그대로 INSERT 하면 PostgreSQL 이 존을 버려
// 두 Node 프로세스의 TZ 가 다를 때 저장된 벽시계가 통째로 밀린다
// (중앙=UTC 컨테이너 ↔ Windows 네이티브 엣지=KST → 매 날짜가 9시간 이동).
// 그래서 전송 대상 SELECT 는 날짜/시간 컬럼을 PostgreSQL 이 출력한 '원문 문자열' 그대로
// 받아 왜곡을 원천 차단한다. (bytea 등 나머지 타입은 기본 파서 유지 → Buffer 등 그대로)
import { PoolClient, types as pgTypes } from 'pg';

// 날짜/시간 계열 OID: date(1082), timestamp(1114), timestamptz(1184), time(1083), timetz(1266)
const RAW_DATE_OIDS = new Set([1082, 1114, 1184, 1083, 1266]);

export function getTypeParser(oid: number, format?: any): any {
  if (RAW_DATE_OIDS.has(oid)) return (v: any) => v; // 날짜/시간: 변환 없이 원문 유지
  return (pgTypes as any).getTypeParser(oid, format);
}

/** 원문-날짜 보존 SELECT. 반환은 rows 배열. */
export async function rawQuery<T extends Record<string, any> = any>(
  client: PoolClient,
  text: string,
  values?: any[]
): Promise<T[]> {
  const res = await client.query<T>({ text, values, types: { getTypeParser } } as any);
  return res.rows;
}
