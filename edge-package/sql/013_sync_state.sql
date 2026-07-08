-- =============================================================================
-- 013_sync_state.sql
-- 선상 엣지 ↔ 중앙 동기화: 엣지 커서(워터마크) 보관
-- 설계 근거: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.2
--
-- 적용 대상: 주로 엣지 로컬 DB(중앙엔 있어도 무해).
-- upload:   last_seq = 중앙이 ack 한 '엣지 change_seq' 상한
-- download: last_seq = 적용한 '중앙 change_seq' 상한 (수신 행의 max, V2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sync_state (
  peer            text NOT NULL,             -- 'central'
  direction       text NOT NULL,             -- 'upload' | 'download'
  last_seq        bigint NOT NULL DEFAULT 0,
  last_success_at timestamp,
  PRIMARY KEY (peer, direction)
);

-- 초기 커서(없으면 0부터)
INSERT INTO sync_state (peer, direction, last_seq)
VALUES ('central', 'upload', 0), ('central', 'download', 0)
ON CONFLICT (peer, direction) DO NOTHING;

-- 롤백(참고): DROP TABLE sync_state;
