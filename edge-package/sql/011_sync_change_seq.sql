-- =============================================================================
-- 011_sync_change_seq.sql
-- 선상 엣지 ↔ 중앙 동기화: 시계 비의존 델타 워터마크(change_seq)
-- 설계 근거: MD/00.Build/SHIP_EDGE_SYNC_DESIGN_2026-07-01.md §3.1, §4.1
--
-- 적용 대상: 엣지 로컬 DB + 중앙 RDS 양쪽 동일 적용.
-- 성격: 가법적(additive) — nullable 컬럼 + BEFORE 트리거. 기존 INSERT/UPDATE 무영향.
-- 주의: 최초 1회 백필이 전 행을 1회 갱신(짧은 락). 데이터량 소규모라 영향 미미.
-- =============================================================================

-- 1) DB별 단조증가 시퀀스 (벽시계 대신 이 순번으로 델타 판정 → 시계 왜곡 무관)
CREATE SEQUENCE IF NOT EXISTS pms_change_seq;

-- 2) 동기화 대상 13개 테이블에 change_seq 컬럼 + 인덱스
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'vessel','equipment','section','maintenance_plan','maintenance_extension',
  'maintenance_work','used_parts','warehouse','material','receive','release','loss','user'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS change_seq bigint;', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%s_change_seq ON %I (change_seq);', t, t);
  END LOOP;
END $$;

-- 3) 공통 트리거 함수
--    - 일반 쓰기: change_seq 자동 부여
--    - 수신 적용 중(app.sync_apply='on'): 미부여 → 받은 행이 자기 델타에 재진입하지 않음(에코 차단, F2)
CREATE OR REPLACE FUNCTION set_change_seq() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.sync_apply', true) = 'on' THEN
    RETURN NEW;   -- 원격 수신분: 로컬 델타에 재진입시키지 않음
  END IF;
  NEW.change_seq := nextval('pms_change_seq');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- 4) 트리거 부착 + 기존 데이터 백필(최초 1회)
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'vessel','equipment','section','maintenance_plan','maintenance_extension',
  'maintenance_work','used_parts','warehouse','material','receive','release','loss','user'
];
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
--   DROP TRIGGER trg_<table>_change_seq ON <table>;  -- 각 테이블
--   DROP FUNCTION set_change_seq();
--   ALTER TABLE <table> DROP COLUMN change_seq;       -- 각 테이블
--   DROP SEQUENCE pms_change_seq;
