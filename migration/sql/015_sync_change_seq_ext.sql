-- =============================================================================
-- 015_sync_change_seq_ext.sql
-- 선상 엣지 ↔ 중앙 동기화: change_seq 보강 — 011 이 빠뜨린 2개 테이블
-- 설계 근거: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.1, §4.1
--
-- 적용 대상: 중앙 RDS (선택). 011_sync_change_seq.sql 의 대상 13개에는
--            machine, equipment_runtime 가 빠져 있었다. 이 둘을 동일 패턴으로 보강한다.
-- 성격: 가법적(additive) · 멱등(idempotent) — nullable 컬럼 + BEFORE 트리거.
--       최초 1회 백필이 전 행에 순번을 1회 부여(짧은 락, 데이터량 소규모라 영향 미미).
--
-- 주의(선상에는 적용하지 말 것):
--   이 스크립트는 중앙(central) 전용이며 백필을 포함한다. 선상 엣지는
--   edge-package/sql/100_pms_on_document_db.sql 이 (백필 없이) machine/equipment_runtime
--   을 이미 포함하므로 이 파일을 선상에서 실행할 필요가 없다.
--
-- 앱 영향: 이 마이그레이션 없이도 앱은 정상 동작한다. machine / equipment_runtime 에
--          change_seq 가 없으면 동기화가 두 테이블을 "전량 전송(full)" 로 폴백할 뿐이다.
--          (본 보강을 적용하면 델타 전송으로 전환되어 효율이 올라간다.)
-- =============================================================================

-- 0) 공통 시퀀스/트리거 함수는 011 에서 이미 생성됨. 없을 경우를 대비해 보강(멱등).
CREATE SEQUENCE IF NOT EXISTS pms_change_seq;

CREATE OR REPLACE FUNCTION set_change_seq() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.sync_apply', true) = 'on' THEN
    RETURN NEW;   -- 원격 수신분: 로컬 델타에 재진입시키지 않음
  END IF;
  NEW.change_seq := nextval('pms_change_seq');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- 1) 보강 대상 2개 테이블에 change_seq 컬럼 + 인덱스
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY['machine','equipment_runtime'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS change_seq bigint;', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%s_change_seq ON %I (change_seq);', t, t);
  END LOOP;
END $$;

-- 2) 트리거 부착 + 기존 데이터 백필(최초 1회, 중앙 전용)
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY['machine','equipment_runtime'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_change_seq ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_change_seq BEFORE INSERT OR UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_change_seq();', t, t);
  END LOOP;

  -- 백필: 현재 행에 순번 부여(트리거 우회, 직접 UPDATE)
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('UPDATE %I SET change_seq = nextval(''pms_change_seq'') WHERE change_seq IS NULL;', t);
  END LOOP;
END $$;

-- 롤백(참고):
--   DROP TRIGGER trg_machine_change_seq ON machine;
--   DROP TRIGGER trg_equipment_runtime_change_seq ON equipment_runtime;
--   ALTER TABLE machine DROP COLUMN change_seq;
--   ALTER TABLE equipment_runtime DROP COLUMN change_seq;
