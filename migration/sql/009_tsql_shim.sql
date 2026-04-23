-- =============================================================================
-- ToadsPMS — T-SQL 호환성 shim for PostgreSQL
-- =============================================================================
-- 목적: 96개 API 라우트에 산재한 T-SQL 내장 함수 호출을
--       코드 변경 없이 PostgreSQL 런타임에서 동작시키기 위한 호환 함수.
--
-- 적용 범위:
--   - public.getdate()                        ← T-SQL GETDATE()
--   - public.isnull(anyelement, anyelement)   ← T-SQL ISNULL(a, b)
--   - public.dateadd(unit, n, dt)             ← T-SQL DATEADD(unit, n, dt)
--   - public.datediff(unit, a, b)             ← T-SQL DATEDIFF(unit, a, b)
--   - public.convert_varchar_121(dt)          ← T-SQL CONVERT(VARCHAR(10), dt, 121)
--     (※ public.convert 오버로드는 bytea 인코딩 함수와 충돌하므로 금지.
--        call-site 에서 convert(varchar(10), x, 121) → to_char(x, 'YYYY-MM-DD')
--        치환이 근본 해결책. 본 shim 은 호출 코드를 한 번에 바꾸기 어려운
--        경우의 임시 이행 보조용.)
--
-- 배포 규칙:
--   1) RDS 인스턴스에서 마스터 권한으로 실행.
--   2) 애플리케이션 role 에 `GRANT EXECUTE ON FUNCTION public.xxx TO toadsapp;` 부여.
--   3) search_path 에 public 이 포함되어 있어야 함 (`SHOW search_path;`).
--   4) 블루/그린 · Dump 복원 시 반드시 동반 이관 (MD/00.Build/BUILD_AND_DEPLOY.md §shim 참고).
--
-- 롤백:
--   DROP FUNCTION IF EXISTS public.convert_varchar_121(timestamp);
--   DROP FUNCTION IF EXISTS public.datediff(text, timestamp, timestamp);
--   DROP FUNCTION IF EXISTS public.dateadd(text, integer, timestamp);
--   DROP FUNCTION IF EXISTS public.isnull(anyelement, anyelement);
--   DROP FUNCTION IF EXISTS public.getdate();
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) GETDATE()
-- -----------------------------------------------------------------------------
create or replace function public.getdate()
returns timestamp
language sql
stable
as $$
  select now()::timestamp
$$;

comment on function public.getdate() is
  'T-SQL GETDATE() shim. Returns current_timestamp as timestamp without timezone.';


-- -----------------------------------------------------------------------------
-- 2) ISNULL(a, b)  — COALESCE 2-arg 시맨틱과 동일
-- -----------------------------------------------------------------------------
create or replace function public.isnull(anyelement, anyelement)
returns anyelement
language sql
immutable
as $$
  select coalesce($1, $2)
$$;

comment on function public.isnull(anyelement, anyelement) is
  'T-SQL ISNULL(a, b) shim. Equivalent to COALESCE(a, b).';


-- -----------------------------------------------------------------------------
-- 3) DATEADD(unit, n, dt)
--    T-SQL unit 식별자: year, quarter, month, week, day, hour, minute, second
--    (별칭 yy, qq, mm, wk, dd, hh, mi/n, ss/s 도 존재하나 현 코드베이스는
--     full-name 위주. 방어적으로 자주 쓰이는 축약도 함께 허용.)
-- -----------------------------------------------------------------------------
create or replace function public.dateadd(unit text, n integer, dt timestamp)
returns timestamp
language plpgsql
immutable
as $$
declare
  u text := lower(unit);
begin
  case u
    when 'year', 'yy', 'yyyy'          then return dt + make_interval(years  => n);
    when 'quarter', 'qq', 'q'          then return dt + make_interval(months => n * 3);
    when 'month', 'mm', 'm'            then return dt + make_interval(months => n);
    when 'week', 'wk', 'ww'            then return dt + make_interval(days   => n * 7);
    when 'day', 'dd', 'd'              then return dt + make_interval(days   => n);
    when 'hour', 'hours', 'hh'         then return dt + make_interval(hours  => n);
    when 'minute', 'mi', 'n'           then return dt + make_interval(mins   => n);
    when 'second', 'ss', 's'           then return dt + make_interval(secs   => n);
    else
      raise exception 'public.dateadd: unsupported unit %', unit;
  end case;
end
$$;

comment on function public.dateadd(text, integer, timestamp) is
  'T-SQL DATEADD(unit, n, dt) shim. Supports year/quarter/month/week/day/hour/minute/second and common abbreviations.';


-- -----------------------------------------------------------------------------
-- 4) DATEDIFF(unit, a, b)
--    주의: T-SQL DATEDIFF 는 "boundary crossings" 카운트 시맨틱.
--    - day    : b::date - a::date (일자 경계 횟수)
--    - month  : year/month 경계 횟수
--    - year   : year 경계 횟수
--    - hour/minute/second : 경과 시간 floor
-- -----------------------------------------------------------------------------
create or replace function public.datediff(unit text, a timestamp, b timestamp)
returns integer
language plpgsql
immutable
as $$
declare
  u text := lower(unit);
  months_diff int;
begin
  case u
    when 'day', 'dd', 'd' then
      return (b::date - a::date);
    when 'hour', 'hours', 'hh' then
      return floor(extract(epoch from (b - a)) / 3600)::int;
    when 'minute', 'mi', 'n' then
      return floor(extract(epoch from (b - a)) / 60)::int;
    when 'second', 'ss', 's' then
      return floor(extract(epoch from (b - a)))::int;
    when 'week', 'wk', 'ww' then
      return floor((b::date - a::date) / 7.0)::int;
    when 'month', 'mm', 'm' then
      return (extract(year  from b)::int - extract(year  from a)::int) * 12
           + (extract(month from b)::int - extract(month from a)::int);
    when 'year', 'yy', 'yyyy' then
      return (extract(year from b)::int - extract(year from a)::int);
    when 'quarter', 'qq', 'q' then
      months_diff := (extract(year  from b)::int - extract(year  from a)::int) * 12
                   + (extract(month from b)::int - extract(month from a)::int);
      return months_diff / 3;
    else
      raise exception 'public.datediff: unsupported unit %', unit;
  end case;
end
$$;

comment on function public.datediff(text, timestamp, timestamp) is
  'T-SQL DATEDIFF(unit, a, b) shim. Boundary-crossing semantics for day/month/year/quarter/week; floor-epoch for hour/minute/second.';


-- -----------------------------------------------------------------------------
-- 4b) DATEADD / DATEDIFF — T-SQL "epoch zero" (1900-01-01) integer overloads
--    T-SQL 관용구 `datediff(wk, 0, getdate())` / `dateadd(wk, <n>, 0)` 는
--    정수 0 을 날짜 1900-01-01 로 암묵 해석한다. PG 는 int→timestamp 자동
--    변환이 없으므로 오버로드를 추가해 동일 시맨틱을 재현한다.
-- -----------------------------------------------------------------------------
create or replace function public.datediff(unit text, a integer, b timestamp)
returns integer
language sql
immutable
as $$
  select public.datediff($1, ('1900-01-01'::timestamp + make_interval(days => $2)), $3)
$$;

create or replace function public.datediff(unit text, a timestamp, b integer)
returns integer
language sql
immutable
as $$
  select public.datediff($1, $2, ('1900-01-01'::timestamp + make_interval(days => $3)))
$$;

create or replace function public.datediff(unit text, a integer, b integer)
returns integer
language sql
immutable
as $$
  select public.datediff(
           $1,
           ('1900-01-01'::timestamp + make_interval(days => $2)),
           ('1900-01-01'::timestamp + make_interval(days => $3))
         )
$$;

create or replace function public.dateadd(unit text, n integer, dt integer)
returns timestamp
language sql
immutable
as $$
  select public.dateadd($1, $2, ('1900-01-01'::timestamp + make_interval(days => $3)))
$$;

comment on function public.datediff(text, integer, timestamp) is
  'T-SQL DATEDIFF overload: integer arg treated as days since 1900-01-01 (T-SQL zero date).';
comment on function public.datediff(text, timestamp, integer) is
  'T-SQL DATEDIFF overload: integer arg treated as days since 1900-01-01.';
comment on function public.datediff(text, integer, integer) is
  'T-SQL DATEDIFF overload: both args treated as days since 1900-01-01.';
comment on function public.dateadd(text, integer, integer) is
  'T-SQL DATEADD overload: integer base treated as days since 1900-01-01.';


-- -----------------------------------------------------------------------------
-- 5) CONVERT_VARCHAR_121(dt) — convert(varchar(10), dt, 121) 대체 보조
--    ⚠ public.convert 오버로드는 bytea 인코딩 함수(pg_catalog.convert)와
--       시그니처 충돌하므로 생성 금지. call-site 치환이 정석.
-- -----------------------------------------------------------------------------
create or replace function public.convert_varchar_121(dt timestamp)
returns text
language sql
immutable
as $$
  select to_char(dt, 'YYYY-MM-DD')
$$;

comment on function public.convert_varchar_121(timestamp) is
  'T-SQL CONVERT(VARCHAR(10), dt, 121) shim helper. Use to_char(dt, ''YYYY-MM-DD'') at call site as the long-term fix.';


-- =============================================================================
-- 셀프 테스트 (배포 후 한 번 실행하여 결과 확인)
-- =============================================================================
-- select public.getdate()                                                  as "getdate";
-- select public.isnull(null::text, 'fallback')                             as "isnull_null";
-- select public.isnull('value'::text, 'fallback')                          as "isnull_value";
-- select public.dateadd('month', 1, '2026-01-31'::timestamp)               as "dateadd_month";
-- select public.dateadd('day',   7, '2026-04-23'::timestamp)               as "dateadd_day";
-- select public.datediff('day',  '2026-04-01'::timestamp,
--                                '2026-04-23'::timestamp)                  as "datediff_day";
-- select public.datediff('month','2026-01-31'::timestamp,
--                                '2026-04-01'::timestamp)                  as "datediff_month";
-- select public.convert_varchar_121('2026-04-23 15:30:00'::timestamp)      as "convert_121";
