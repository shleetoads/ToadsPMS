-- =============================================================================
-- 100_pms_on_document_db.sql   (scripts/gen_ship_pms_sql.py 로 자동 생성 — 직접 수정 금지)
-- 선상(엣지) PC: 기존 "document" DB 에 PMS 전용 객체를 가법적으로 추가한다.
--
-- [목적]
--   선박 PC 에는 이미 document 프로그램용 PostgreSQL DB 가 있고, 그 안에
--   vessel / "user" / tenant / position 과 fn_get_code_name / fn_get_position /
--   fn_get_user 가 들어 있다. PMS 를 "같은 DB" 에 올리기 위해 PMS 전용
--   테이블 15개 + 함수 3개 + 프로시저 1개 + 동기화 인프라만 설치한다.
--
-- [전제조건]
--   - 접속 대상 DB 에 document 스키마(특히 vessel, "user")가 이미 존재해야 한다.
--     없으면 사전점검(pre-flight)에서 즉시 중단한다(잘못된 DB 보호).
--
-- [성격]
--   - 가법적(additive) · 멱등(idempotent): 두 번 실행해도 안전.
--   - document 쪽 테이블/함수는 절대 DROP/ALTER 하지 않는다.
--   - vessel / "user" 에는 change_seq 컬럼·트리거를 붙이지 않는다(타 프로그램 소유).
--   - 기존 데이터 백필(UPDATE ... change_seq) 을 하지 않는다
--     (데이터 수신 후 재실행 시 전 행을 "업로드 대상"으로 오탐하는 것을 방지).
--
-- [실행 방법]
--   psql -h 127.0.0.1 -U <user> -d <document_db> -v ON_ERROR_STOP=1 -f 100_pms_on_document_db.sql
--   (엣지 패키지에서는 edge-package/1B_기존DB에_PMS테이블_추가.bat 가 호출한다.)
-- =============================================================================

BEGIN;

SET client_encoding = 'UTF8';
-- 함수 본문이 참조하는 테이블은 아래에서 먼저 생성하지만, 순서 의존을 없애기 위해 본문검증 off
SET check_function_bodies = false;

-- -----------------------------------------------------------------------------
-- 0) 사전점검: document DB 가 맞는지 확인 (vessel / "user" 존재)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.vessel') IS NULL OR to_regclass('public."user"') IS NULL THEN
    RAISE EXCEPTION '[설치중단] 이 DB 에서 document 기본 테이블(vessel / "user")을 찾을 수 없습니다. PMS 는 document DB 에만 추가할 수 있습니다. 접속 DB 이름을 확인하세요.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1) PMS 전용 테이블 15개 (덤프의 컬럼 정의 그대로, IF NOT EXISTS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.material_type (
    code character varying(5) NOT NULL,
    name character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer
);
CREATE TABLE IF NOT EXISTS public.material_unit (
    code character varying(5) NOT NULL,
    name character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer
);
CREATE TABLE IF NOT EXISTS public.machine (
    vessel_no character varying(20) NOT NULL,
    machine_name character varying(100) NOT NULL,
    manufacturer character varying(100),
    machine_desc character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    sort_no integer,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);
CREATE TABLE IF NOT EXISTS public.equipment (
    vessel_no character varying(20) NOT NULL,
    equip_no character varying(10) NOT NULL,
    equip_name character varying(200),
    manufacturer character varying(100),
    model character varying(50),
    specifications character varying(100),
    description character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    category character varying(50),
    lastest_date date,
    machine_name character varying(100) NOT NULL,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);
CREATE TABLE IF NOT EXISTS public.equipment_runtime (
    vessel_no character varying(20) NOT NULL,
    machine_name character varying(100) NOT NULL,
    equip_no character varying(50) NOT NULL,
    equip_name character varying(200),
    lastest_upload_date timestamp without time zone,
    lastest_runtime integer,
    prev_upload_date timestamp without time zone,
    prev_runtime integer
);
CREATE TABLE IF NOT EXISTS public.warehouse (
    vessel_no character varying(20) NOT NULL,
    warehouse_no character varying(20) NOT NULL,
    warehouse_name character varying(100),
    warehouse_desc character varying(200),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    warehouse_location character varying(100),
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);
CREATE TABLE IF NOT EXISTS public.material (
    vessel_no character varying(20) NOT NULL,
    material_code character varying(30) NOT NULL,
    material_name character varying(200),
    material_group character varying(100),
    material_spec character varying(200),
    material_type character varying(100),
    material_unit character varying(10),
    drawing_no character varying(50),
    machine_name character varying(20),
    standard_qty integer,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone,
    warehouse_no character varying(20)
);
CREATE TABLE IF NOT EXISTS public.section (
    vessel_no character varying(20) NOT NULL,
    equip_no character varying(10) NOT NULL,
    section_code character varying(10) NOT NULL,
    section_name character varying(200),
    description character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);
CREATE TABLE IF NOT EXISTS public.maintenance_plan (
    vessel_no character varying(20) NOT NULL,
    equip_no character varying(10) NOT NULL,
    section_code character varying(10) NOT NULL,
    plan_code character varying(10) NOT NULL,
    plan_name character varying(200),
    manufacturer character varying(100),
    model character varying(50),
    specifications character varying(100),
    lastest_date date,
    workers integer,
    work_hours integer,
    "interval" integer,
    interval_term character varying(10),
    location character varying(1),
    self_maintenance character varying(1),
    manager character varying(100),
    important_items character varying(1),
    instructions character varying(500),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    critical character varying(10),
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone,
    prev_pms_code character varying(20),
    lastest_run_hour integer
);
CREATE TABLE IF NOT EXISTS public.maintenance_extension (
    vessel_no character varying(20) NOT NULL,
    equip_no character varying(10) NOT NULL,
    section_code character varying(10) NOT NULL,
    plan_code character varying(10) NOT NULL,
    extension_seq integer NOT NULL,
    extension_date timestamp without time zone,
    extension_reason character varying(500),
    request_date timestamp without time zone,
    applicant integer,
    approval_status character varying(10),
    approval_date timestamp without time zone,
    approver integer,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone,
    approval_reason character varying(200)
);
CREATE TABLE IF NOT EXISTS public.maintenance_work (
    vessel_no character varying(20) NOT NULL,
    work_order integer NOT NULL,
    work_date date,
    manager character varying(100),
    work_details character varying(500),
    used_parts character varying(200),
    work_hours integer,
    delay_reason character varying(500),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    equip_no character varying(10) NOT NULL,
    section_code character varying(10) NOT NULL,
    plan_code character varying(10) NOT NULL,
    plan_date timestamp without time zone,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone,
    lastest_run_hour integer
);
CREATE TABLE IF NOT EXISTS public.used_parts (
    vessel_no character varying(20) NOT NULL,
    work_order integer NOT NULL,
    part_seq integer NOT NULL,
    warehouse_no character varying(20),
    material_code character varying(20),
    use_unit character varying(10),
    use_qty integer,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);
CREATE TABLE IF NOT EXISTS public.receive (
    vessel_no character varying(20) NOT NULL,
    receive_no character varying(20) NOT NULL,
    material_code character varying(30),
    receive_date date,
    receive_type character varying(2),
    receive_unit character varying(10),
    receive_qty integer,
    receive_location character varying(20),
    receive_remark character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    receive_reason character varying(200),
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone,
    delivery_location character varying(100)
);
CREATE TABLE IF NOT EXISTS public.release (
    vessel_no character varying(20) NOT NULL,
    release_no character varying(20) NOT NULL,
    material_code character varying(30),
    release_date date,
    release_type character varying(2),
    release_unit character varying(10),
    release_qty integer,
    release_location character varying(20),
    work_order integer,
    part_seq integer,
    release_remark character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    release_reason character varying(200),
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);
CREATE TABLE IF NOT EXISTS public.loss (
    vessel_no character varying(20) NOT NULL,
    loss_no character varying(20) NOT NULL,
    material_code character varying(30),
    loss_date date,
    loss_unit character varying(10),
    loss_qty integer,
    loss_location character varying(20),
    loss_reason character varying(200),
    loss_remark character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    loss_type character varying(2),
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);

-- -----------------------------------------------------------------------------
-- 2) PRIMARY KEY 제약 (멱등 가드)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_material_type'
                    AND conrelid = 'public.material_type'::regclass) THEN
    ALTER TABLE public.material_type ADD CONSTRAINT pk_material_type PRIMARY KEY (code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_material_unit'
                    AND conrelid = 'public.material_unit'::regclass) THEN
    ALTER TABLE public.material_unit ADD CONSTRAINT pk_material_unit PRIMARY KEY (code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_machine'
                    AND conrelid = 'public.machine'::regclass) THEN
    ALTER TABLE public.machine ADD CONSTRAINT pk_machine PRIMARY KEY (vessel_no, machine_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_equipment'
                    AND conrelid = 'public.equipment'::regclass) THEN
    ALTER TABLE public.equipment ADD CONSTRAINT pk_equipment PRIMARY KEY (equip_no, vessel_no, machine_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_equipment_runtime'
                    AND conrelid = 'public.equipment_runtime'::regclass) THEN
    ALTER TABLE public.equipment_runtime ADD CONSTRAINT pk_equipment_runtime PRIMARY KEY (vessel_no, machine_name, equip_no);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_material_location'
                    AND conrelid = 'public.warehouse'::regclass) THEN
    ALTER TABLE public.warehouse ADD CONSTRAINT pk_material_location PRIMARY KEY (vessel_no, warehouse_no);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_material'
                    AND conrelid = 'public.material'::regclass) THEN
    ALTER TABLE public.material ADD CONSTRAINT pk_material PRIMARY KEY (vessel_no, material_code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_section'
                    AND conrelid = 'public.section'::regclass) THEN
    ALTER TABLE public.section ADD CONSTRAINT pk_section PRIMARY KEY (equip_no, section_code, vessel_no);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_maintenance_plan'
                    AND conrelid = 'public.maintenance_plan'::regclass) THEN
    ALTER TABLE public.maintenance_plan ADD CONSTRAINT pk_maintenance_plan PRIMARY KEY (equip_no, section_code, plan_code, vessel_no);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_maintenance_extension'
                    AND conrelid = 'public.maintenance_extension'::regclass) THEN
    ALTER TABLE public.maintenance_extension ADD CONSTRAINT pk_maintenance_extension PRIMARY KEY (equip_no, section_code, plan_code, vessel_no, extension_seq);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_maintenance_work'
                    AND conrelid = 'public.maintenance_work'::regclass) THEN
    ALTER TABLE public.maintenance_work ADD CONSTRAINT pk_maintenance_work PRIMARY KEY (vessel_no, work_order);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_used_parts'
                    AND conrelid = 'public.used_parts'::regclass) THEN
    ALTER TABLE public.used_parts ADD CONSTRAINT pk_used_parts PRIMARY KEY (vessel_no, work_order, part_seq);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_warehouse'
                    AND conrelid = 'public.receive'::regclass) THEN
    ALTER TABLE public.receive ADD CONSTRAINT pk_warehouse PRIMARY KEY (receive_no, vessel_no);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_release'
                    AND conrelid = 'public.release'::regclass) THEN
    ALTER TABLE public.release ADD CONSTRAINT pk_release PRIMARY KEY (vessel_no, release_no);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'pk_loss'
                    AND conrelid = 'public.loss'::regclass) THEN
    ALTER TABLE public.loss ADD CONSTRAINT pk_loss PRIMARY KEY (vessel_no, loss_no);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) FOREIGN KEY 제약 (멱등 가드, 참조 대상 생성 후)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'fk_maintenance_extension'
                    AND conrelid = 'public.maintenance_extension'::regclass) THEN
    ALTER TABLE public.maintenance_extension ADD CONSTRAINT fk_maintenance_extension FOREIGN KEY (equip_no, section_code, plan_code, vessel_no) REFERENCES public.maintenance_plan(equip_no, section_code, plan_code, vessel_no);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'fk_maintenance_plan_section'
                    AND conrelid = 'public.maintenance_plan'::regclass) THEN
    ALTER TABLE public.maintenance_plan ADD CONSTRAINT fk_maintenance_plan_section FOREIGN KEY (equip_no, section_code, vessel_no) REFERENCES public.section(equip_no, section_code, vessel_no);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'fk_maintenance_work_maintenance_plan'
                    AND conrelid = 'public.maintenance_work'::regclass) THEN
    ALTER TABLE public.maintenance_work ADD CONSTRAINT fk_maintenance_work_maintenance_plan FOREIGN KEY (equip_no, section_code, plan_code, vessel_no) REFERENCES public.maintenance_plan(equip_no, section_code, plan_code, vessel_no);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'fk_maintenance_work_used_parts'
                    AND conrelid = 'public.used_parts'::regclass) THEN
    ALTER TABLE public.used_parts ADD CONSTRAINT fk_maintenance_work_used_parts FOREIGN KEY (vessel_no, work_order) REFERENCES public.maintenance_work(vessel_no, work_order);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'relationship13'
                    AND conrelid = 'public.release'::regclass) THEN
    ALTER TABLE public.release ADD CONSTRAINT relationship13 FOREIGN KEY (vessel_no, material_code) REFERENCES public.material(vessel_no, material_code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'relationship19'
                    AND conrelid = 'public.loss'::regclass) THEN
    ALTER TABLE public.loss ADD CONSTRAINT relationship19 FOREIGN KEY (vessel_no, material_code) REFERENCES public.material(vessel_no, material_code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'relationship8'
                    AND conrelid = 'public.receive'::regclass) THEN
    ALTER TABLE public.receive ADD CONSTRAINT relationship8 FOREIGN KEY (vessel_no, material_code) REFERENCES public.material(vessel_no, material_code);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5) PMS 전용 함수 3 + 프로시저 1 (CREATE OR REPLACE, 본문 덤프 그대로)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_maintenance_extension(p_vessel_no character varying, p_equip_no character varying, p_section_code character varying, p_plan_code character varying) RETURNS timestamp without time zone
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_result_extension_date timestamp;
BEGIN
    SELECT max(extension_date)
      INTO v_result_extension_date
      FROM maintenance_extension
     WHERE vessel_no = p_vessel_no
       AND equip_no = p_equip_no
       AND section_code = p_section_code
       AND plan_code = p_plan_code;

    RETURN v_result_extension_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_material_type(p_type_name character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_code varchar(50);
BEGIN
    SELECT code
      INTO v_code
      FROM material_type
     WHERE (code = rtrim(p_type_name) OR name = rtrim(p_type_name))
       AND use_yn = 'Y'
     LIMIT 1;

    RETURN COALESCE(v_code, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_material_unit(p_unit_name character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_code varchar(50);
BEGIN
    SELECT code
      INTO v_code
      FROM material_unit
     WHERE name = rtrim(p_unit_name)
       AND use_yn = 'Y'
     LIMIT 1;

    RETURN COALESCE(v_code, '');
END;
$$;

CREATE OR REPLACE PROCEDURE public.usp_upsert_equipment_runtime(IN p_vessel_no character varying, IN p_machine_name character varying, IN p_equip_no character varying, IN p_equip_name character varying, IN p_runtime integer, IN p_upload_date timestamp without time zone DEFAULT NULL::timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_upload_date timestamp;
    v_today date;
BEGIN
    IF p_upload_date IS NULL THEN
        v_upload_date := timezone('UTC', now());
    ELSE
        v_upload_date := p_upload_date;
    END IF;

    v_today := v_upload_date::date;

    INSERT INTO equipment_runtime (
        vessel_no,
        machine_name,
        equip_no,
        equip_name,
        lastest_upload_date,
        lastest_runtime,
        prev_upload_date,
        prev_runtime
    )
    VALUES (
        p_vessel_no,
        p_machine_name,
        p_equip_no,
        p_equip_name,
        v_upload_date,
        p_runtime,
        NULL,
        NULL
    )
    ON CONFLICT (vessel_no, machine_name, equip_no)
    DO UPDATE SET
        equip_name = EXCLUDED.equip_name,
        prev_upload_date = CASE
            WHEN equipment_runtime.lastest_upload_date::date = v_today
                THEN equipment_runtime.prev_upload_date
            ELSE equipment_runtime.lastest_upload_date
        END,
        prev_runtime = CASE
            WHEN equipment_runtime.lastest_upload_date::date = v_today
                THEN equipment_runtime.prev_runtime
            ELSE equipment_runtime.lastest_runtime
        END,
        lastest_upload_date = v_upload_date,
        lastest_runtime = p_runtime;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6) 동기화 인프라 (선상 전용) — 011_sync_change_seq.sql 패턴 기반
--    * 선상 차이점: vessel / "user" 제외(타 프로그램 소유), 백필 없음.
-- -----------------------------------------------------------------------------

-- 6-1) DB별 단조증가 시퀀스 (벽시계 대신 이 순번으로 델타 판정)
CREATE SEQUENCE IF NOT EXISTS pms_change_seq;

-- 6-2) 동기화 대상 13개 PMS 테이블에 change_seq 컬럼 + 인덱스
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'machine',
  'equipment',
  'equipment_runtime',
  'section',
  'maintenance_plan',
  'maintenance_extension',
  'maintenance_work',
  'used_parts',
  'warehouse',
  'material',
  'receive',
  'release',
  'loss'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS change_seq bigint;', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%s_change_seq ON %I (change_seq);', t, t);
  END LOOP;
END $$;

-- 6-3) 공통 트리거 함수
--      - 일반 쓰기: change_seq 자동 부여
--      - 수신 적용 중(app.sync_apply='on'): 미부여 → 받은 행 에코 차단
CREATE OR REPLACE FUNCTION set_change_seq() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.sync_apply', true) = 'on' THEN
    RETURN NEW;   -- 원격 수신분: 로컬 델타에 재진입시키지 않음
  END IF;
  NEW.change_seq := nextval('pms_change_seq');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- 6-4) 트리거 부착 (백필 없음 — 데이터 수신 후 재실행 안전)
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'machine',
  'equipment',
  'equipment_runtime',
  'section',
  'maintenance_plan',
  'maintenance_extension',
  'maintenance_work',
  'used_parts',
  'warehouse',
  'material',
  'receive',
  'release',
  'loss'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_change_seq ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_change_seq BEFORE INSERT OR UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_change_seq();', t, t);
  END LOOP;
END $$;

-- 6-5) 엣지 커서(워터마크) 보관 테이블 + 초기 2행 (013_sync_state.sql)
CREATE TABLE IF NOT EXISTS sync_state (
  peer            text NOT NULL,             -- 'central'
  direction       text NOT NULL,             -- 'upload' | 'download'
  last_seq        bigint NOT NULL DEFAULT 0,
  last_success_at timestamp,
  PRIMARY KEY (peer, direction)
);

INSERT INTO sync_state (peer, direction, last_seq)
VALUES ('central', 'upload', 0), ('central', 'download', 0)
ON CONFLICT (peer, direction) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7) 설치 결과 확인 (화면 출력) — 각 객체 존재 여부 + change_seq 보유 여부
-- -----------------------------------------------------------------------------
SELECT t.table_name,
       (to_regclass('public.' || quote_ident(t.table_name)) IS NOT NULL) AS exists,
       EXISTS (
         SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = t.table_name
            AND c.column_name = 'change_seq'
       ) AS has_change_seq
FROM (VALUES
  ('material_type'),
  ('material_unit'),
  ('machine'),
  ('equipment'),
  ('equipment_runtime'),
  ('warehouse'),
  ('material'),
  ('section'),
  ('maintenance_plan'),
  ('maintenance_extension'),
  ('maintenance_work'),
  ('used_parts'),
  ('receive'),
  ('release'),
  ('loss'),
  ('sync_state')
) AS t(table_name)
ORDER BY t.table_name;

-- 루틴(함수 3 + 프로시저 1) 존재 확인
SELECT p.proname, p.prokind   -- prokind: f=함수, p=프로시저
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('fn_get_maintenance_extension','fn_get_material_type','fn_get_material_unit','usp_upsert_equipment_runtime')
 ORDER BY p.proname;

COMMIT;
