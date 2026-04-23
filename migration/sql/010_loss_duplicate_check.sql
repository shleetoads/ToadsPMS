-- =============================================================================
-- ToadsPMS — §9.1 `loss` 테이블 중복 데이터 진단 / 정리 스크립트
-- =============================================================================
-- 배경:
--   마이그레이션 B1 배치에서 `data/inventory/loss/sets/route.ts` 의 MERGE ON 절이
--     a.lossNo = b.lossNo    (camelCase, T-SQL 시절부터의 silent bug)
--   →
--     a.loss_no = b.loss_no  (snake_case 정정)
--   로 수정되었다. 기존 운영 기간 동안 T-SQL 은 NULL = NULL → false 로 평가하여
--   MERGE 가 거의 항상 INSERT 분기로 갔을 가능성이 있고, 이 경우 동일한
--   (vessel_no, loss_no) 쌍이 중복 적재된 row 들이 남아있다.
--
-- 이 파일은 3 단계로 구성된다:
--   1) 진단 쿼리  — 중복 여부/규모 파악 (읽기 전용, 항상 먼저 실행)
--   2) 백업       — 중복 row 전량을 아카이브 테이블로 복제
--   3) 정리 쿼리  — regist_date 최신 row 만 남기고 나머지 물리 삭제
--                  (2번 백업 완료 확인 후 수동 블록 해제하여 실행)
--
-- 실행 순서:
--   psql "host=... dbname=pms user=..."
--   \i migration/sql/010_loss_duplicate_check.sql
--   → STEP 1 결과로 중복 규모 확인
--   → 없으면 여기서 종료
--   → 있으면 STEP 2, 3 을 주석 해제하여 재실행
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1. 진단 — 읽기 전용
-- -----------------------------------------------------------------------------

-- 1-a. 중복 그룹 요약
select vessel_no
     , loss_no
     , count(*) as dup_count
     , min(regist_date) as earliest_regist
     , max(regist_date) as latest_regist
  from loss
 group by vessel_no, loss_no
having count(*) > 1
 order by dup_count desc, vessel_no, loss_no;

-- 1-b. 전체 요약 (한 줄)
select count(*)                         as total_rows
     , count(distinct (vessel_no, loss_no)) as distinct_keys
     , count(*) - count(distinct (vessel_no, loss_no)) as redundant_rows
  from loss;

-- 1-c. 대표 샘플 (중복 상위 10 그룹의 raw row 나열)
with dup as (
  select vessel_no, loss_no
    from loss
   group by vessel_no, loss_no
  having count(*) > 1
   order by count(*) desc
   limit 10
)
select l.*
  from loss l
  join dup using (vessel_no, loss_no)
 order by l.vessel_no, l.loss_no, l.regist_date;


-- -----------------------------------------------------------------------------
-- STEP 2. 백업 (주석 해제하여 실행)
-- -----------------------------------------------------------------------------
-- 중복이 확인되면 아래를 주석 해제하고 실행.
-- 타임스탬프 접미사는 복원 추적 용도.
--
-- create table if not exists loss_dup_backup_20260423 as
-- select *
--   from loss
--  where (vessel_no, loss_no) in (
--          select vessel_no, loss_no
--            from loss
--           group by vessel_no, loss_no
--          having count(*) > 1
--        );
--
-- select count(*) as backed_up_rows from loss_dup_backup_20260423;


-- -----------------------------------------------------------------------------
-- STEP 3. 정리 — regist_date 최신만 남기고 삭제 (주석 해제하여 실행)
-- -----------------------------------------------------------------------------
-- ⚠ STEP 2 백업 완료 + backed_up_rows 수치 확인 후에만 실행.
--
-- begin;
--
-- -- 3-a. 각 (vessel_no, loss_no) 그룹 내에서 regist_date 최신 row 의 ctid 보존,
-- --      나머지 삭제. ctid 는 PG 물리 row 식별자 (동일 key 내에서도 unique).
-- with ranked as (
--   select ctid
--        , vessel_no
--        , loss_no
--        , row_number() over (
--            partition by vessel_no, loss_no
--            order by regist_date desc nulls last, ctid desc
--          ) as rn
--     from loss
-- )
-- delete from loss l
--  using ranked r
--  where l.ctid = r.ctid
--    and r.rn > 1;
--
-- -- 3-b. 검증: 아래가 0 이어야 정리 완료.
-- select count(*) as remaining_dup
--   from (
--     select vessel_no, loss_no
--       from loss
--      group by vessel_no, loss_no
--     having count(*) > 1
--   ) t;
--
-- -- commit;   -- 결과 확인 후 수동 commit
-- -- rollback;  -- 이상 발견 시 rollback
