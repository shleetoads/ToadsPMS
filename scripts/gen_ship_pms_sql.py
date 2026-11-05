#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_ship_pms_sql.py
-------------------
migration/sql/000_base_schema.sql(PMS 전체 pg_dump --schema-only) 을 읽어
선상용 설치 스크립트 edge-package/sql/100_pms_on_document_db.sql 을 재현성 있게 생성한다.

배경:
  선박 PC 에는 이미 "document" 프로그램용 PostgreSQL DB 가 있고 그 DB 안에
  vessel / "user" / tenant / position 과 fn_get_code_name / fn_get_position /
  fn_get_user 가 들어 있다. PMS 는 이 "같은 DB" 에 추가로 올라가야 한다.
  따라서 PMS 전용 객체(테이블 15개 + 함수 3개 + 프로시저 1개)만 가법적으로,
  재실행 안전(idempotent)하게 설치하는 SQL 을 만든다.

사용법 (stdlib 전용):
  python -I scripts/gen_ship_pms_sql.py

설계 원칙:
  - pg_dump 텍스트를 직접 파싱해서 컬럼 정의/타입/기본값/제약을 손으로 베끼지 않는다.
  - 번역할 수 없는(멱등 변환 불가) 구문이 대상 테이블에 섞여 있으면 조용히 버리지 말고
    즉시 예외를 던지고 보고한다.
"""

import os
import re
import sys

# ---------------------------------------------------------------------------
# 대상 정의
# ---------------------------------------------------------------------------

# PMS 전용 테이블 15개 — 생성 순서(부모 먼저; IF NOT EXISTS 라 사실상 무관하나 가독성)
TARGET_TABLES = [
    "material_type", "material_unit",
    "machine", "equipment", "equipment_runtime", "warehouse", "material",
    "section", "maintenance_plan", "maintenance_extension", "maintenance_work",
    "used_parts", "receive", "release", "loss",
]

# 동기화(change_seq) 대상 — 위 15개 중 material_type / material_unit 제외 = 13개
SYNC_TABLES = [
    "machine", "equipment", "equipment_runtime", "section", "maintenance_plan",
    "maintenance_extension", "maintenance_work", "used_parts", "warehouse",
    "material", "receive", "release", "loss",
]

# 최종 검증 SELECT 에 보여줄 목록(15 테이블 + sync_state)
VERIFY_NAMES = TARGET_TABLES + ["sync_state"]

# PMS 전용 루틴(함수 3 + 프로시저 1) — 중앙/선상 공통. 생성 순서.
TARGET_ROUTINES = [
    "fn_get_maintenance_extension",
    "fn_get_material_type",
    "fn_get_material_unit",
    "usp_upsert_equipment_runtime",
]

TARGET_TABLE_SET = set(TARGET_TABLES)
TARGET_ROUTINE_SET = set(TARGET_ROUTINES)


# ---------------------------------------------------------------------------
# pg_dump 텍스트 → 최상위 statement 분해 (달러쿼트/문자열/주석 고려)
# ---------------------------------------------------------------------------

def split_statements(sql):
    stmts = []
    buf = []
    i, n = 0, len(sql)
    in_sq = False          # '...' 문자열
    dollar_tag = None      # $tag$ ... $tag$
    dollar_re = re.compile(r"\$[A-Za-z0-9_]*\$")
    while i < n:
        ch = sql[i]
        if dollar_tag is not None:
            if sql.startswith(dollar_tag, i):
                buf.append(dollar_tag)
                i += len(dollar_tag)
                dollar_tag = None
                continue
            buf.append(ch); i += 1; continue
        if in_sq:
            buf.append(ch)
            if ch == "'":
                if i + 1 < n and sql[i + 1] == "'":   # '' escape
                    buf.append("'"); i += 2; continue
                in_sq = False
            i += 1; continue
        if ch == "'":
            in_sq = True; buf.append(ch); i += 1; continue
        if ch == "$":
            m = dollar_re.match(sql, i)
            if m:
                dollar_tag = m.group(0)
                buf.append(dollar_tag); i += len(dollar_tag); continue
        if ch == "-" and i + 1 < n and sql[i + 1] == "-":
            j = sql.find("\n", i)
            if j == -1:
                j = n
            buf.append(sql[i:j]); i = j; continue
        if ch == ";":
            buf.append(ch)
            stmts.append("".join(buf).strip())
            buf = []; i += 1; continue
        buf.append(ch); i += 1
    tail = "".join(buf).strip()
    if tail:
        stmts.append(tail)
    return stmts


def strip_leading_comments(stmt):
    """statement 앞쪽의 -- 주석 줄들을 제거하고 실제 SQL 만 반환."""
    lines = stmt.splitlines()
    while lines and lines[0].lstrip().startswith("--"):
        lines.pop(0)
    return "\n".join(lines).strip()


def unqualify(name):
    """public.foo / public."foo" / "foo" → foo"""
    name = name.strip()
    if name.startswith("public."):
        name = name[len("public."):]
    return name.strip().strip('"')


# ---------------------------------------------------------------------------
# 분류 정규식
# ---------------------------------------------------------------------------

RE_FUNC = re.compile(r'^CREATE (FUNCTION|PROCEDURE)\s+public\.("?[A-Za-z0-9_]+"?)\s*\(', re.S)
RE_TABLE = re.compile(r'^CREATE TABLE\s+public\.("?[A-Za-z0-9_]+"?)\s*\(', re.S)
RE_CONSTRAINT = re.compile(
    r'^ALTER TABLE ONLY\s+(public\.("?[A-Za-z0-9_]+"?))\s+ADD CONSTRAINT\s+("?[A-Za-z0-9_]+"?)\s+(.*)$',
    re.S)
RE_INDEX = re.compile(
    r'^CREATE (UNIQUE )?INDEX\s+("?[A-Za-z0-9_]+"?)\s+ON\s+public\.("?[A-Za-z0-9_]+"?)\b', re.S)
RE_DEFAULT = re.compile(
    r'^ALTER TABLE (?:ONLY )?public\.("?[A-Za-z0-9_]+"?)\s+ALTER COLUMN\s+("?[A-Za-z0-9_]+"?)\s+SET DEFAULT', re.S)
RE_IDENTITY = re.compile(
    r'^ALTER TABLE (?:ONLY )?public\.("?[A-Za-z0-9_]+"?)\s+ALTER COLUMN\s+("?[A-Za-z0-9_]+"?)\s+ADD GENERATED', re.S)
RE_CREATE_SEQ = re.compile(r'^CREATE SEQUENCE\s+public\.("?[A-Za-z0-9_]+"?)', re.S)
RE_ALTER_SEQ_OWNED = re.compile(
    r'^ALTER SEQUENCE\s+public\.("?[A-Za-z0-9_]+"?)\s+OWNED BY\s+public\.("?[A-Za-z0-9_]+"?)\.', re.S)
RE_COMMENT = re.compile(r'^COMMENT ON\b', re.S)


def collapse_ws(s):
    return re.sub(r"\s+", " ", s).strip()


# ---------------------------------------------------------------------------
# 파싱
# ---------------------------------------------------------------------------

def parse(sql):
    """반환: dict(tables, pk_uniq_check, fks, routines) + 미번역 경고 목록."""
    out = {
        "tables": {},        # name -> create-table text (원문)
        "pk_uniq_check": [], # (table_unq, public_tbl_literal, conname, condef)
        "fks": [],           # (table_unq, public_tbl_literal, conname, condef)
        "indexes": [],       # (table_unq, index text)
        "routines": {},      # name -> create text (원문)
        "untranslatable": [] # 보고용
    }
    # 대상 테이블/루틴에 관련된 시퀀스·identity·default 가 나오면 보고(현재 스키마엔 없음)
    for raw in split_statements(sql):
        stmt = strip_leading_comments(raw)
        if not stmt:
            continue

        m = RE_COMMENT.match(stmt)
        if m:
            continue  # COMMENT 는 설치에 불필요 — 무시

        m = RE_FUNC.match(stmt)
        if m:
            name = unqualify(m.group(2))
            if name in TARGET_ROUTINE_SET:
                out["routines"][name] = stmt
            continue

        m = RE_TABLE.match(stmt)
        if m:
            name = unqualify(m.group(1))
            if name in TARGET_TABLE_SET:
                out["tables"][name] = stmt
            continue

        m = RE_CONSTRAINT.match(stmt)
        if m:
            tbl_literal = m.group(1)            # public.xxx
            tbl = unqualify(m.group(2))
            conname = unqualify(m.group(3))
            condef = collapse_ws(m.group(4).rstrip(";").strip())
            if tbl in TARGET_TABLE_SET:
                rec = (tbl, tbl_literal, conname, condef)
                if "FOREIGN KEY" in condef.upper():
                    out["fks"].append(rec)
                else:
                    out["pk_uniq_check"].append(rec)
            continue

        m = RE_INDEX.match(stmt)
        if m:
            tbl = unqualify(m.group(3))
            if tbl in TARGET_TABLE_SET:
                out["indexes"].append((tbl, stmt))
            continue

        m = RE_IDENTITY.match(stmt)
        if m and unqualify(m.group(1)) in TARGET_TABLE_SET:
            out["untranslatable"].append("IDENTITY on %s: %s" % (unqualify(m.group(1)), collapse_ws(stmt)))
            continue

        m = RE_DEFAULT.match(stmt)
        if m and unqualify(m.group(1)) in TARGET_TABLE_SET:
            out["untranslatable"].append("COLUMN DEFAULT on %s: %s" % (unqualify(m.group(1)), collapse_ws(stmt)))
            continue

        m = RE_CREATE_SEQ.match(stmt)
        if m:
            continue  # 소유관계는 ALTER SEQUENCE OWNED BY 로 판정

        m = RE_ALTER_SEQ_OWNED.match(stmt)
        if m and unqualify(m.group(2)) in TARGET_TABLE_SET:
            out["untranslatable"].append("SEQUENCE owned by %s: %s" % (unqualify(m.group(2)), collapse_ws(stmt)))
            continue

    return out


# ---------------------------------------------------------------------------
# 멱등 블록 생성기
# ---------------------------------------------------------------------------

def emit_create_table(text):
    # CREATE TABLE public.x (  →  CREATE TABLE IF NOT EXISTS public.x (
    return re.sub(r"^CREATE TABLE\s+", "CREATE TABLE IF NOT EXISTS ", text, count=1)


def emit_constraint_guard(tbl_literal, conname, condef):
    return (
        "DO $$\n"
        "BEGIN\n"
        "  IF NOT EXISTS (SELECT 1 FROM pg_constraint\n"
        "                  WHERE conname = '%s'\n"
        "                    AND conrelid = '%s'::regclass) THEN\n"
        "    ALTER TABLE %s ADD CONSTRAINT %s %s;\n"
        "  END IF;\n"
        "END $$;\n" % (conname, tbl_literal, tbl_literal, conname, condef)
    )


def emit_index(text):
    # CREATE [UNIQUE] INDEX name  →  ... IF NOT EXISTS name
    t = re.sub(r"^CREATE UNIQUE INDEX\s+", "CREATE UNIQUE INDEX IF NOT EXISTS ", text, count=1)
    if t == text:
        t = re.sub(r"^CREATE INDEX\s+", "CREATE INDEX IF NOT EXISTS ", text, count=1)
    if not t.rstrip().endswith(";"):
        t = t.rstrip() + ";"
    return t


def emit_routine(text):
    t = re.sub(r"^CREATE FUNCTION\s+", "CREATE OR REPLACE FUNCTION ", text, count=1)
    t = re.sub(r"^CREATE PROCEDURE\s+", "CREATE OR REPLACE PROCEDURE ", t, count=1)
    if not t.rstrip().endswith(";"):
        t = t.rstrip() + ";"
    return t


# ---------------------------------------------------------------------------
# 정적 섹션 템플릿
# ---------------------------------------------------------------------------

HEADER = """\
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
"""

SYNC_SECTION_TMPL = """\
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
{sync_array}
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
{sync_array}
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
"""

VERIFY_TMPL = """\
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
{verify_rows}
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
"""


def build(parsed):
    missing_t = [t for t in TARGET_TABLES if t not in parsed["tables"]]
    if missing_t:
        raise SystemExit("[중단] 덤프에서 테이블을 찾지 못함: %s" % ", ".join(missing_t))
    missing_r = [r for r in TARGET_ROUTINES if r not in parsed["routines"]]
    if missing_r:
        raise SystemExit("[중단] 덤프에서 루틴을 찾지 못함: %s" % ", ".join(missing_r))
    if parsed["untranslatable"]:
        raise SystemExit(
            "[중단] 대상 테이블에 멱등 변환 규칙이 없는 구문이 있어 생성을 멈춥니다:\n  - "
            + "\n  - ".join(parsed["untranslatable"]))

    pk_map = {r[0]: r for r in parsed["pk_uniq_check"]}
    missing_pk = [t for t in TARGET_TABLES if t not in pk_map]
    if missing_pk:
        raise SystemExit("[중단] PK 제약을 찾지 못한 테이블: %s" % ", ".join(missing_pk))

    parts = [HEADER]

    # 1) 테이블
    parts.append("-- -----------------------------------------------------------------------------")
    parts.append("-- 1) PMS 전용 테이블 15개 (덤프의 컬럼 정의 그대로, IF NOT EXISTS)")
    parts.append("-- -----------------------------------------------------------------------------")
    for t in TARGET_TABLES:
        body = emit_create_table(parsed["tables"][t])
        if not body.rstrip().endswith(";"):
            body = body.rstrip() + ";"
        parts.append(body)
    parts.append("")

    # 2) PK/UNIQUE/CHECK 제약 (가드)
    parts.append("-- -----------------------------------------------------------------------------")
    parts.append("-- 2) PRIMARY KEY 제약 (멱등 가드)")
    parts.append("-- -----------------------------------------------------------------------------")
    for t in TARGET_TABLES:
        _, lit, conname, condef = pk_map[t]
        parts.append(emit_constraint_guard(lit, conname, condef))

    # 3) FK 제약 (가드) — 모든 테이블/PK 생성 후
    parts.append("-- -----------------------------------------------------------------------------")
    parts.append("-- 3) FOREIGN KEY 제약 (멱등 가드, 참조 대상 생성 후)")
    parts.append("-- -----------------------------------------------------------------------------")
    for tbl, lit, conname, condef in parsed["fks"]:
        parts.append(emit_constraint_guard(lit, conname, condef))

    # 4) 인덱스 (대상 테이블에 있으면)
    if parsed["indexes"]:
        parts.append("-- -----------------------------------------------------------------------------")
        parts.append("-- 4) 인덱스 (IF NOT EXISTS)")
        parts.append("-- -----------------------------------------------------------------------------")
        for _tbl, text in parsed["indexes"]:
            parts.append(emit_index(text))
        parts.append("")

    # 5) 루틴
    parts.append("-- -----------------------------------------------------------------------------")
    parts.append("-- 5) PMS 전용 함수 3 + 프로시저 1 (CREATE OR REPLACE, 본문 덤프 그대로)")
    parts.append("-- -----------------------------------------------------------------------------")
    for r in TARGET_ROUTINES:
        parts.append(emit_routine(parsed["routines"][r]))
        parts.append("")

    # 6) 동기화
    sync_array = ",\n".join("  '%s'" % t for t in SYNC_TABLES)
    parts.append(SYNC_SECTION_TMPL.format(sync_array=sync_array))

    # 7) 검증
    verify_rows = ",\n".join("  ('%s')" % n for n in VERIFY_NAMES)
    parts.append(VERIFY_TMPL.format(verify_rows=verify_rows))

    return "\n".join(parts).rstrip() + "\n"


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    src = os.path.join(root, "migration", "sql", "000_base_schema.sql")
    dst = os.path.join(root, "edge-package", "sql", "100_pms_on_document_db.sql")

    with open(src, "r", encoding="utf-8") as f:
        sql = f.read()

    parsed = parse(sql)
    text = build(parsed)

    with open(dst, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)

    print("생성 완료: %s" % dst)
    print("  테이블 %d, PK %d, FK %d, 인덱스 %d, 루틴 %d, 동기화 테이블 %d" % (
        len(parsed["tables"]), len(parsed["pk_uniq_check"]),
        len(parsed["fks"]), len(parsed["indexes"]),
        len(parsed["routines"]), len(SYNC_TABLES)))


if __name__ == "__main__":
    main()
