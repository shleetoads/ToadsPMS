-- =============================================================================
-- 014_sync_node.sql
-- 선상 엣지 ↔ 중앙 동기화: 중앙 노드 레지스트리(노드 토큰 인증)
-- 설계 근거: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §5 (D2, NFR-2)
--
-- 적용 대상: 중앙 RDS.
-- 토큰 원문은 저장하지 않고 sha256 해시만 보관. 노드는 (node_id, vessel_no)당 1행.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sync_node (
  node_id       text PRIMARY KEY,          -- 예: 'edge-dsrj2-01'
  vessel_no     text NOT NULL,             -- 이 노드가 대표하는 선박
  token_hash    bytea NOT NULL,            -- sha256(token) — 원문 저장 금지
  status        char(1) NOT NULL DEFAULT 'A',  -- A(active) / S(suspended)
  last_seen_at  timestamp,
  regist_date   timestamp DEFAULT now(),
  regist_user   text,
  modify_date   timestamp,
  modify_user   text
);

CREATE INDEX IF NOT EXISTS ix_sync_node_vessel ON sync_node (vessel_no);

-- 노드 발급 예시(운영: 관리 UI/스크립트로 대체):
--   토큰 발급 = 32바이트 랜덤 hex, 노드엔 NODE_TOKEN으로 주입, 중앙엔 해시만 저장.
--   INSERT INTO sync_node (node_id, vessel_no, token_hash, regist_user)
--   VALUES ('edge-dsrj2-01', 'DSRJ2', decode(encode(digest('<TOKEN>','sha256'),'hex'),'hex'), 'admin');
--   (digest 사용 시 pgcrypto 필요. 없으면 앱에서 sha256 계산해 bytea로 저장.)

-- 롤백(참고): DROP TABLE sync_node;
