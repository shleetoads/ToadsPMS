-- =============================================================================
-- 012_soft_delete.sql
-- 선상 엣지 ↔ 중앙 동기화: 삭제 전파를 위한 소프트 삭제(tombstone)
-- 설계 근거: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.3, §4.2 (FR-5)
--
-- 적용 대상: 엣지 로컬 DB + 중앙 RDS 양쪽 동일 적용.
-- 성격: 가법적 — deleted_yn/deleted_at 컬럼 추가(기본 'N').
-- 후속(P1.5): 물리 DELETE 라우트를 UPDATE deleted_yn='Y'로 전환,
--             전 조회 경로에 deleted_yn='N' 필터(활성행 뷰 v_* 권고).
-- =============================================================================

DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'vessel','equipment','section','maintenance_plan','maintenance_extension',
  'maintenance_work','used_parts','warehouse','material','receive','release','loss','user'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_yn char(1) DEFAULT ''N'';', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at timestamp;', t);
  END LOOP;
END $$;

-- 롤백(참고):
--   ALTER TABLE <table> DROP COLUMN deleted_yn, DROP COLUMN deleted_at;  -- 각 테이블
