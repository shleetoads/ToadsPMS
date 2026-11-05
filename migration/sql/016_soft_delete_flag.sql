-- =============================================================================
-- 016_soft_delete_flag.sql
-- 소프트 삭제 플래그(delete_yn) — 중앙(central) DB 수동 마이그레이션(폴백)
--
-- 적용 대상: 중앙 RDS. (엣지는 앱 기동 시 자동 보강되므로 별도 실행 불필요)
-- 성격: 가법적(additive) · 멱등(idempotent). nullable 아닌 상수 DEFAULT 컬럼 추가는
--       PostgreSQL 11+ 에서 테이블 재작성 없이 즉시 완료된다(짧은 ACCESS EXCLUSIVE 락만).
--
-- 왜 필요: 물리 삭제 대신 delete_yn='Y' 업데이트로 삭제를 표현한다(삭제도 일반 UPDATE 로
--          기존 동기화가 그대로 전파). delete_yn 으로 필터링하는 앱 버전을 배포하기 "전 또는
--          함께" 이 컬럼이 반드시 있어야 한다. 앱도 기동 시(/api/scheduler/schema) 스스로
--          추가를 시도하지만, 앱 DB 롤이 DDL 권한이 없을 수 있어 이 파일이 폴백이다.
--
-- 관례: vessel.delete_yn / "user".delete_yn 와 동일 (character(1) NOT NULL DEFAULT 'N').
-- 참고: 012_soft_delete.sql 의 deleted_yn / deleted_at 은 본 기능과 무관한 레거시이며 미사용이다.
-- =============================================================================

SET lock_timeout = '5s';

DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY['warehouse','material','receive'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
         SELECT 1 FROM information_schema.tables
          WHERE table_schema = current_schema() AND table_name = t
       )
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = t AND column_name = 'delete_yn'
       ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN delete_yn character(1) NOT NULL DEFAULT ''N'';', t);
    END IF;
  END LOOP;
END $$;

-- 롤백(참고):
--   ALTER TABLE warehouse DROP COLUMN delete_yn;
--   ALTER TABLE material  DROP COLUMN delete_yn;
--   ALTER TABLE receive   DROP COLUMN delete_yn;
