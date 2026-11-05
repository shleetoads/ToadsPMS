#!/usr/bin/env node
// issue_node_token.mjs
// 선상 엣지 노드 토큰 발급기 (의존성 없음, node:crypto 만 사용)
//
// 사용법:
//   node scripts/issue_node_token.mjs <VESSEL_NO> [NODE_ID]
//
// 출력:
//   (a) config.env 의 NODE_TOKEN 에 넣을 토큰 원문(32바이트 hex)
//   (b) 중앙(central) DB 에 바로 실행할 수 있는 INSERT 문
//       (token_hash = sha256(token) — lib/sync/nodeAuth.ts 의 hashToken 과 동일)
//   (c) 검증용 SELECT
//
// 주의: 토큰 원문은 중앙 DB 에 저장하지 않는다(해시만 저장). 토큰은 발급 후
//       config.env 에만 보관하며 분실 시 재발급해야 한다.

import { randomBytes, createHash } from 'node:crypto';

function fail(msg) {
  console.error(`[오류] ${msg}`);
  process.exit(1);
}

const vesselNo = process.argv[2];
let nodeId = process.argv[3];

if (!vesselNo) {
  fail('사용법: node scripts/issue_node_token.mjs <VESSEL_NO> [NODE_ID]');
}

// VESSEL_NO 형식 검증 (영문/숫자/밑줄/하이픈만)
if (!/^[A-Za-z0-9_-]+$/.test(vesselNo)) {
  fail(`VESSEL_NO 형식이 올바르지 않습니다: "${vesselNo}" (허용: 영문/숫자/_/- )`);
}

// 기본 node_id = edge-<vessel 소문자>-01
if (!nodeId) {
  nodeId = `edge-${vesselNo.toLowerCase()}-01`;
}

// 32바이트 랜덤 토큰(hex) + sha256(토큰 원문) hex
const token = randomBytes(32).toString('hex');
const tokenHashHex = createHash('sha256').update(token, 'utf8').digest('hex');

const sqlInsert =
`INSERT INTO sync_node (node_id, vessel_no, token_hash, status, regist_date, regist_user)
VALUES ('${nodeId}', '${vesselNo}', decode('${tokenHashHex}','hex'), 'A', now(), 'admin')
ON CONFLICT (node_id) DO UPDATE SET
  vessel_no  = EXCLUDED.vessel_no,
  token_hash = EXCLUDED.token_hash,
  status     = 'A',
  modify_date = now();`;

const sqlVerify =
`SELECT node_id, vessel_no, status, encode(token_hash,'hex') AS token_hash_hex, regist_date
  FROM sync_node
 WHERE node_id = '${nodeId}';`;

console.log('================================================================');
console.log(' 선상 엣지 노드 토큰 발급 결과');
console.log('================================================================');
console.log(`  VESSEL_NO : ${vesselNo}`);
console.log(`  NODE_ID   : ${nodeId}`);
console.log('');
console.log('(a) config.env 에 넣을 값 (선상 PC) ----------------------------');
console.log(`NODE_TOKEN=${token}`);
console.log('');
console.log('(b) 중앙(central) DB 에서 실행할 SQL ---------------------------');
console.log(sqlInsert);
console.log('');
console.log('(c) 발급 확인용 SELECT -----------------------------------------');
console.log(sqlVerify);
console.log('================================================================');
console.log('※ 토큰 원문은 다시 볼 수 없습니다. config.env 에 안전하게 보관하세요.');
