> **2026-04-23 UPDATE — 잔여 작업 전량 완료** ✅
> - §2 §7.2 활성 8파일: 0건
> - §5 MERGE alias LHS: 23파일 410개소 제거 완료
> - §4/§8 call-site 치환: `convert(varchar,…)` 88건 / `format(...)` 35건 전량 제거
> - 추가 발견: `year(getdate())`, `datepart(wk,…)`, `AS [period]` 3곳 수정
> - §3 주석 cleanup: dashboard/execution/all 레거시 주석 블록 174줄 삭제
> - §8 shim DDL: `migration/sql/009_tsql_shim.sql` 작성 완료, `MD/00.Build/BUILD_AND_DEPLOY.md §15` 배포 절차 추가
> - `npm run build` 통과, 에러/경고 0건
> - **남은 것은 RDS 에 shim DDL 적용 1회 + §10 smoke test 뿐**

# ToadsPMS — MSSQL→PostgreSQL 배치 마이그레이션 이후 **잔여 작업 심층 검토**

> **작성 목적**: B1~B12 배치 작업(블로커 3 + §7.2 87 파일)이 종료된 현 시점에서, **남아있는 수정 대상**을 한 문서에서 끝까지 추적할 수 있게 한다.
> **작성 시점**: 2026-04-21
> **대상 범위**: `E:\Resources\ToadsPMS\app\api\**\route.ts` (`@/db` import 기준 128 파일)
> **검토 관점(페르소나)**: analyzer · backend · architect · qa · data
> **선행 문서**: `REMAINING_MIGRATION_ANALYSIS.md` (배치 작업 착수 직전 스냅샷)
> **본 문서 스탠스**: 이 문서는 **코드 수정이 아니라 식별/우선순위화/리스크 분석**만 수행한다. 실제 치환 작업은 후속 세션에서 §7, §8 체크리스트를 따라 수행한다.

---

## §0. 30초 요약

| 지표 | 수치 | 비고 |
|---|---|---|
| 전체 API 라우트 | 128 | `@/db` import 기준 (신규 파일 1개 추가됨) |
| **레거시 mssql 패턴**(`getSql`, `pool.transaction`, `rowsAffected`, `new sql.Request`, `transantion`, `request.input`, `.recordset`) | **0 파일** | ✅ 배치 작업으로 완전 제거 |
| **§7.2 실행 경로 대괄호 위반** | **8 파일** (활성 SQL 기준) | `common/*` 2 + `ship/inventory/warehouse/*` 3 + `data/inventory/*` 3 |
| §7.2 주석 내 대괄호/`dbo.fn_*` 잔존 | **2 파일** | `ship/dashboard`, `ship/execution/all` — cosmetic only |
| `EXEC dbo.usp_*` | **0 파일** | ✅ `ship/equipmentRuntime/insert`에서 `CALL` 로 치환 완료 |
| **§P2 지연 대상**(`getdate/dateadd/datediff/isnull/convert/format`) | **96 파일 / 671 occurrences** | 호환 레이어 전략 결정 필요 |
| **`MERGE` T-SQL 문** | **25 파일** | PG 15+ `MERGE` 네이티브 지원 확인 + `a.col=b.col` 좌변 스타일 호환성 검토 필요 |
| 사전 식별된 기능성 버그 | **1건** | `data/inventory/loss/sets/route.ts` — B1 중 `lossNo→loss_no` silent fix (§9.1) |
| 빌드 차단성 예상 | **없음** | 현재 남은 `[warehouse]` 등은 PG에서 **런타임 에러(syntax)** 이지 컴파일 에러는 아님 |
| 예상 잔여 소요 | **3~5h** (§7.2 치환) **+ 1~2일** (§P2 호환 레이어 설계·배포·회귀) | |

**결론**: `npm run build` 는 통과할 가능성이 높다(파일 import 단계는 해결됨). 그러나 **아래 3개 문제 중 하나라도 런타임에 미치면 500 에러**가 뜬다:
1. 8개 §7.2 활성 파일의 `[table]` 구문 → PG 파서에서 즉시 syntax error.
2. 96개 파일의 §P2 T-SQL 내장 함수 → PG에 해당 함수 없으면 `function X does not exist` 로 실패.
3. 25개 `MERGE` 문의 T-SQL 고유 문법(`AS a ... ON (...) WHEN MATCHED THEN UPDATE SET a.col = b.col`) → PG 15+는 `UPDATE SET col = b.col` (좌변 alias 불가) 형태를 요구.

---

## §1. 레거시 mssql 패턴 — 완전 해소 ✅

아래 패턴의 grep 결과는 모두 **0 건**이다:

```
getSql | pool\.transaction | \.rowsAffected | new sql\.Request | transantion | request\.input | \.recordset
```

즉 `import { getSql, getPool } from '@/db'` 로 인한 TS2305 빌드 실패는 **해소되었다**. 빌드 차단 없음.

- 이전 Blocker 3파일(`data/inventory/receive/sets`, `data/inventory/loss/sets`, `data/all/set`) 은 모두 `withTransaction` + `adaptNamedParams` Beta 패턴으로 재작성됨.
- 실행 경로의 `@paramName` → `$N` 매핑은 `@/db/adaptNamedParams`(또는 `query`/`execute` 래퍼 내부)에서 단일화 처리.

---

## §2. §7.2 실행 경로 — **활성 SQL 8 파일** (최우선)

### §2.1 대괄호 잔존 테이블 매트릭스

| # | 파일 | 대괄호 테이블 | 출현 횟수 | 성격 | PG 예약어 여부 | 권장 변환 |
|---|---|---|---:|---|---|---|
| 1 | `common/vessel/code/route.ts:23` | `[machine]` | 1 | SELECT (join) | ❌ | `machine` |
| 2 | `common/machine/code/route.ts:14` | `[machine]` | 1 | SELECT (FROM) | ❌ | `machine` |
| 3 | `ship/inventory/warehouse/update/route.ts:13,45` | `[warehouse]` | 2 | UPDATE | ❌ | `warehouse` |
| 4 | `ship/inventory/warehouse/insert/route.ts:13,25,54,57,79` | `[warehouse]` | 5 | INSERT + 서브쿼리 + UPDATE | ❌ | `warehouse` |
| 5 | `ship/inventory/warehouse/delete/route.ts:13` | `[warehouse]` | 1 | DELETE | ❌ | `warehouse` |
| 6 | `data/inventory/warehouse/set/route.ts:12` | `[warehouse]` | 1 | MERGE | ❌ | `warehouse` |
| 7 | `data/inventory/warehouse/remove/route.ts:12` | `[warehouse]` | 1 | DELETE | ❌ | `warehouse` |
| 8 | `data/inventory/adjustment/receive/set/route.ts:12` | `[receive]` | 1 | MERGE | ❌ | `receive` |

**합계: 8 파일 / 13 occurrences**

### §2.2 리스크 분석

- 이 8파일은 **현재 배포 시 PG 쿼리 파서 단계에서 즉시 실패**한다. `[identifier]` 는 T-SQL 고유 구문이고 PG에서는 `"identifier"` 만 유효(반대로 `warehouse`/`receive`/`machine` 은 PG 예약어가 아니므로 따옴표 없이 그대로 써도 된다).
- `ship/inventory/warehouse/delete/route.ts:13` 의 `delete [warehouse]` 는 T-SQL 축약형. PG에서는 `DELETE FROM warehouse` 처럼 `FROM` 이 필수다. **단순 대괄호 제거로는 부족**하며, `delete warehouse` → `delete from warehouse` 변환이 추가 필요.
  - ⚠ **architect 관점**: `insert`/`update` 쪽 배치 작업에서 이 축약형이 또 있는지 후속 grep (`\bdelete\s+\w+\s+where\b`) 1회 돌리는 게 안전하다.
- `data/inventory/adjustment/receive/set/route.ts` 는 `merge [receive] as a ... on (vessel_no,receive_no) when matched then update set a.col = b.col` 구조. **PG 15+ MERGE는 `UPDATE SET a.col` 을 허용하지 않는다 (§5 참조)**.
- `ship/inventory/warehouse/insert/route.ts` 의 서브쿼리 `(select format(isnull(max(warehouse_no), 0) + 1, '00') ...)` 는 §P2 대상(`format`, `isnull`) 이 함께 섞여있으므로 §4 호환 레이어 배포 여부에 따라 작업 순서가 달라진다.

### §2.3 권장 처리 순서

1. `common/*` 2 파일 (단순 조회, 리스크 最低).
2. `ship/inventory/warehouse/{delete, update}` (단순 DML, `delete` 축약형 주의).
3. `ship/inventory/warehouse/insert` (서브쿼리 + §P2 의존).
4. `data/inventory/warehouse/{set, remove}` + `data/inventory/adjustment/receive/set` (MERGE — §5 선결 필요).

---

## §3. §7.2 주석 내 잔존 — **2 파일, cosmetic**

| 파일 | 위치 | 내용 | 영향 |
|---|---|---|---|
| `ship/dashboard/route.ts:42,69,72` | `//` 블록 | `[vessel]`, `[maintenance_plan]`, `[equipment]`, `dbo.fn_get_maintenance_extension` | ❌ 런타임 무관 |
| `ship/execution/all/route.ts:70,71,73,103,102` | `//` 블록 | 동일 패턴 | ❌ 런타임 무관 |

- **런타임 영향 없음**(주석). 그러나 `rg "dbo\.(fn_|usp_)"` / `rg "\[(vessel|user|...)\]"` 같은 회귀 grep을 false-positive 없이 유지하려면 코드 정리 때 함께 제거하는 것을 권장한다.
- 권장 처리: 해당 파일의 활성 SQL(CTE `LatestExtension`/`PlanBase`) 정상 동작을 **스모크 테스트로 한 번 확인한 뒤**, 구버전 주석 블록을 삭제 (git blame 용도로 남겨둘 이유가 적음 — 커밋 이력으로 대체).

---

## §4. §P2 지연 대상 — **96 파일 / 671 occurrences** (전략 결정 필수)

### §4.1 현황

| T-SQL 함수 | PG 대응 | 치환 난이도 |
|---|---|---|
| `getdate()` | `now()` 또는 `current_timestamp` | ★☆ |
| `dateadd(unit, n, dt)` | `dt + make_interval(...)` 또는 `dt + (n \|\| ' days')::interval` | ★★★ (unit별 분기) |
| `datediff(unit, a, b)` | `extract(epoch from (b-a))/86400` 등 | ★★★ (HOURS/DAY/MONTH/YEAR 각각 다름) |
| `isnull(a, b)` | `coalesce(a, b)` | ★☆ |
| `convert(varchar(10), dt, 121)` | `to_char(dt, 'YYYY-MM-DD')` | ★★ |
| `format(n, '00')` | `lpad(n::text, 2, '0')` 또는 `to_char(n, 'FM00')` | ★★ |

### §4.2 두 가지 전략

#### (A) **호환 레이어**(shim 함수)를 Postgres에 배포

```sql
-- 예시: public.getdate(), public.isnull(anyelement, anyelement) 등
create or replace function public.getdate() returns timestamptz language sql stable as $$ select now() $$;
create or replace function public.isnull(anyelement, anyelement) returns anyelement language sql immutable as $$ select coalesce($1,$2) $$;
-- dateadd, datediff, format 은 plpgsql로 unit 분기 처리
```

| 장점 | 단점 |
|---|---|
| 96 파일을 **코드 변경 없이** 런타임 통과 가능 | shim에 숨은 edge case (NULL 처리, timezone, locale) |
| 점진적 마이그레이션 가능 (파일별로 native로 대체) | search_path 관리 필요. RDS 복원/블루그린 배포 시 반드시 동반 이관 |
| 회귀 리스크 낮음 | 성능 영향 (volatile vs stable 분류 실수 시 planner 저하) |

#### (B) **per-site 수동 치환** (파일 단위로 T-SQL → PG native)

| 장점 | 단점 |
|---|---|
| shim 의존 없음, 최종 형태 깔끔 | 671 occurrences × 평균 2min = **~22h** 소요 |
| PG planner 최적화 혜택 | 치환 실수 시 버그 (특히 `dateadd` HOURS 분기) |
| 스키마 이전(on-prem ↔ RDS) 시 어디서든 작동 | 각 파일 smoke test 필요 |

### §4.3 권장 — **A 먼저, 뒤에 B로 대체**

- **즉시 런타임 복구**를 위해 (A) 배포: `public.getdate / isnull / dateadd / datediff / convert_varchar_121 / format_leading_zero` 6개 함수만 있으면 96파일 전부 통과.
- (A) 배포 직후 **빌드+스모크 테스트**로 기능 검증. 이 단계에서 최소 50% 이상 기능이 살아나야 한다.
- 이후 per-domain sprint 단위로 (B) 전환. 우선순위: `calendar/dashboard/maintenance/extension` (사용자 노출 높고 날짜 계산 민감) → `inventory` → `data/*` admin 동기화.

### §4.4 호환 레이어 배포 체크리스트

- [ ] RDS 인스턴스에 `public.*` 함수 6종 생성 (DDL 버전 태깅: `migration/sql/009_tsql_shim.sql`).
- [ ] `search_path` 에 `public` 포함 확인 (`show search_path;`).
- [ ] `pg_function_is_visible(...)` 로 현재 세션 적용 여부 점검.
- [ ] 각 함수 단위 테스트 (NULL, 경계값, timezone 'Asia/Seoul').
- [ ] 롤백 플랜: `DROP FUNCTION public.getdate() CASCADE;` 스크립트 준비.
- [ ] 블루/그린 배포·Dump 복원 시 이 DDL 동반 이관 규정 추가 (`MD/00.Build/BUILD_AND_DEPLOY.md` 갱신 필요).

---

## §5. `MERGE` 문 — **25 파일** (PG 15+ 호환성 재검토 필요)

### §5.1 파일 목록 (`merge ` grep)

```
ship/{section,equipment,maintenance}/save
data/{equipment,section,maintenance,all}/set
data/inventory/{loss,receive,material,warehouse,adjustment/receive,adjustment/release}/sets|set
ship/inventory/material/{insert,update,upload}
admin/ships/{[vesselNo]/{section,equipment,maintenance}/save, save, [vesselNo]/upload}
admin/inventory/material/{insert,update,upload}
scheduler/receive
```

### §5.2 T-SQL vs PG MERGE 차이점

| 항목 | T-SQL | PG 15+ |
|---|---|---|
| `USING (values_table) AS alias` | OK | OK |
| `ON (cond)` | OK | OK |
| `WHEN MATCHED THEN UPDATE SET a.col = b.col` | alias 좌변 허용 | **좌변 alias 금지** — `SET col = b.col` 로 써야 함 |
| `WHEN NOT MATCHED THEN INSERT (...) VALUES (...)` | OK | OK (단 `INSERT VALUES` 앞에 `THEN` 필요) |
| trailing `;` 요구 | 요구 | 선택 |
| target table 대괄호 | `[table]` | **금지** (`"table"` 또는 plain) |

### §5.3 리스크

- §2의 `data/inventory/warehouse/set/route.ts`, `data/inventory/adjustment/receive/set/route.ts` 는 대괄호 + 좌변 alias(`a.col = b.col`) **두 가지가 모두** PG-비호환. 배치 작업에서 제외되었는지 여부에 따라 재작업 필요.
- 이미 Beta 패턴(`withTransaction`)으로 바뀐 파일 중에도 내부 SQL 본문에 `set a.col = b.col` 이 남아있을 수 있음. **qa 관점** grep 재실행 권장:
  - `rg -n "when matched then" -A 8 app/api | rg -n "set\s+\w+\.\w+\s*="` (좌변 alias 탐지)

### §5.4 권장 처리

- §2.3 순서에 맞추어 MERGE 대상 파일에 한해 **UPDATE SET alias 좌변 제거** 일괄 패스 1회 수행.
- 가능하면 SQL을 두 단계로 재구성(`INSERT ... ON CONFLICT (key) DO UPDATE SET ...`) 검토. ON CONFLICT 패턴이 PG-native 이며 성능·가독성 모두 유리.

---

## §6. 잔존 소스 구조 리스크 (architect)

### §6.1 `admin/ships/[vesselNo]/maintenance/route.ts` — 트리 빌더

- 이 파일(`/api/admin/ships/[vesselNo]/maintenance/route.ts`)은 SQL 하나(비교적 긴 left outer join 체인) + JS 상에서 **vessel→machine→equipment→section→task** 트리 구축.
- 쿼리 자체는 §7.2/§P2 통과 (브래킷 없음, `convert(varchar(10), ..., 121)` 와 `isnull` 과 `dateadd` 포함 — §P2 호환 레이어 필요).
- **backend 관점** 코드 품질 이슈:
  - `children: [] = []` 는 TS에서 빈 배열 할당 + 타입 단언 혼용으로 읽기 어려움. `children: []` 로 충분.
  - `maintenance = item; maintenance.id = item.plan_code` 는 **mutation 공유**. 동일 row가 여러 섹션에 속한 경우(현재는 없지만 향후 리팩터 시) 부작용 가능.
  - `vessel.children.push(item)` (L150, L199) 에서 `item` 자체를 push하기 때문에 parent/child가 동일 레퍼런스. §P2 호환 레이어 도입 후 **별도 스모크 테스트 필수** (특히 `type: 'TASK'` 가 올바르게 세팅되는지).
- **qa 관점**: `items.map` 반환값을 버리는데 `forEach` 쓰는 게 의도에 맞음. side-effect map은 lint 경고 대상.

### §6.2 `data/all/set/route.ts` (1074 → 1039 LOC)

- Beta 패턴 적용 확인됨. 13 블록의 `adaptNamedParams → client.query → rowCount` 반복은 `replace_all` 로 일괄 치환.
- **잠재 리스크**: 13개 MERGE 중 `[release]` 테이블 다루는 블록의 인용 정확성. PG에서 `release` 는 **예약어가 아님**(INSERT/UPDATE 타겟으로 plain identifier 허용). 그러나 `SELECT ... FROM release` 같은 문장은 파서 문맥에 따라 모호해질 수 있어 `"release"` 로 통일한 것이 안전. 현재 상태 재확인 권장.
- `count += result.rowCount ?? 0` 누적값이 13 블록 각각의 성공 여부를 숨긴다. **qa 관점**: 한 블록이라도 0을 반환하면 전체 롤백할지, 일부 성공이 허용되는지 사양 재확인 필요.

### §6.3 `data/inventory/loss/sets/route.ts` — **사전 식별된 silent bug fix**

- B1 Blocker 배치에서 `ON` 절의 `a.lossNo = b.lossNo` → `a.loss_no = b.loss_no` 로 이름 규칙 정정 (camelCase → snake_case).
- 이는 **마이그레이션 범위 외** 변경이며 **T-SQL/PG 동작 차이와 무관한 기능 버그**였다.
- **필요 조치**: 해당 변경 커밋 메시지에 `[bugfix-nonmigration]` 라벨 붙이고 CHANGELOG에 별도 항목 등록.
- **qa 관점**: 기존에 운영 중이었다면 `ON (lossNo)` 은 NULL = NULL (T-SQL 의 기본 동작 역시 false) 로 인해 **MERGE가 전부 INSERT 브랜치로 분기**했을 가능성. 즉 기존 loss 내역이 **중복 삽입**되었을 여지가 있다. 운영 DB 대상 `select vessel_no, loss_no, count(*) from loss group by 1,2 having count(*)>1` 검증 필요.

---

## §7. 실행 체크리스트 — 잔여 8파일 수정(§7.2)

> 아래는 **후속 세션에서 실제 수정 시** 따라야 할 mechanical 체크리스트.

### §7.1 공통 변환 규칙 (재확인)

| 패턴 | 변환 | 비고 |
|---|---|---|
| `[table]` (non-reserved: machine, equipment, warehouse, receive, loss, material 등) | `table` | 따옴표 없이 plain |
| `[user]`, `[release]` | `"user"`, `"release"` | PG 예약어 |
| `delete [t] where ...` | `delete from t where ...` | `FROM` 보강 필수 |
| `dbo.fn_X(...)` | `public.fn_X(...)` 또는 native 재작성 | (주석만 있으면 삭제) |
| `EXEC dbo.usp_X @a, @b` | `CALL usp_X($1, $2)` 또는 프로시저 포팅 | 현재 0건 |
| `merge [t] as a ... set a.col = b.col` | `merge t as a ... set col = b.col` | PG 15+ 좌변 alias 금지 |

### §7.2 파일별 변환 메모

1. `common/vessel/code/route.ts` — L23 `left outer join [machine] as b` → `left outer join machine as b`. 커밋 단독.
2. `common/machine/code/route.ts` — L14 `from [machine]` → `from machine`. 커밋 단독.
3. `ship/inventory/warehouse/update/route.ts` — L13, L45 두 `update [warehouse]` → `update warehouse`. 트랜잭션 불필요 (단순 execute).
4. `ship/inventory/warehouse/insert/route.ts` — L13/25/54/57/79 5곳 모두 `[warehouse]` → `warehouse`. 추가로 서브쿼리 내 `format(isnull(max(warehouse_no), 0) + 1, '00')` 는 §4 호환 레이어 전제.
5. `ship/inventory/warehouse/delete/route.ts` — L12 `delete [warehouse]` → `delete from warehouse`. **`FROM` 보강 필수**.
6. `data/inventory/warehouse/set/route.ts` — L12 `merge [warehouse] as a` → `merge warehouse as a`. 또한 `when matched then update set a.warehouse_name = b.warehouse_name ...` 구문의 **좌변 `a.` 제거** 필요 (PG 15+).
7. `data/inventory/warehouse/remove/route.ts` — L12 `delete [warehouse]` → `delete from warehouse`. FROM 보강.
8. `data/inventory/adjustment/receive/set/route.ts` — L12 `merge [receive] as a` → `merge receive as a`. 좌변 `a.` 제거 일괄.

### §7.3 검증 grep (수정 후)

```bash
rg -n "\[(vessel|user|release|machine|equipment|section|maintenance_plan|maintenance_work|maintenance_extension|warehouse|material|receive|loss|used_parts)\]" app/api
rg -n "dbo\.(fn_|usp_)" app/api
rg -n "\bEXEC\s+" app/api -i
rg -n "when\s+matched\s+then\s+update\s+set\s+\w+\.\w+\s*=" app/api -i
rg -n "\bdelete\s+\w+\s+where\b" app/api | rg -v "delete from"
```
모두 0 건이어야 §7.2/§5 통과.

---

## §8. 실행 체크리스트 — §P2 호환 레이어 배포

```sql
-- migration/sql/009_tsql_shim.sql (신규)

create or replace function public.getdate() returns timestamp language sql stable as $$
  select now()::timestamp
$$;

create or replace function public.isnull(anyelement, anyelement) returns anyelement language sql immutable as $$
  select coalesce($1, $2)
$$;

create or replace function public.dateadd(unit text, n integer, dt timestamp) returns timestamp language plpgsql immutable as $$
begin
  return case lower(unit)
    when 'year'   then dt + make_interval(years  => n)
    when 'month'  then dt + make_interval(months => n)
    when 'day'    then dt + make_interval(days   => n)
    when 'hour'   then dt + make_interval(hours  => n)
    when 'hours'  then dt + make_interval(hours  => n)
    when 'minute' then dt + make_interval(mins   => n)
    else dt + make_interval(days => n)
  end;
end $$;

create or replace function public.datediff(unit text, a timestamp, b timestamp) returns integer language plpgsql immutable as $$
begin
  return case lower(unit)
    when 'day'    then (b::date - a::date)
    when 'hour'   then floor(extract(epoch from (b - a)) / 3600)::int
    when 'hours'  then floor(extract(epoch from (b - a)) / 3600)::int
    when 'month'  then (extract(year  from b)::int - extract(year  from a)::int) * 12
                      + (extract(month from b)::int - extract(month from a)::int)
    when 'year'   then (extract(year from b)::int - extract(year from a)::int)
    else (b::date - a::date)
  end;
end $$;

-- convert(varchar(10), dt, 121) → to_char(dt, 'YYYY-MM-DD')
-- format(n, '00')             → lpad(n::text, 2, '0')
-- 두 가지는 호출 side 그대로 두기 어려우므로 **B-option** 권장.
-- 단 긴급 런타임 복구가 필요하면 아래처럼 최소 shim 추가 가능:
create or replace function public.convert_varchar_121(dt timestamp) returns text language sql immutable as $$
  select to_char(dt, 'YYYY-MM-DD')
$$;
```

**주의**: PG의 `convert` 는 bytea 인코딩 함수(예약)이므로 `public.convert` 오버로드는 **금지**. 기존 SQL의 `convert(varchar(10), x, 121)` 은 반드시 call-site 치환(`to_char(x, 'YYYY-MM-DD')`)으로 처리. 이 제약 때문에 **(A)-only 전략은 불가능**하고 hybrid가 불가피하다.

### §8.1 call-site 치환 최소 범위(부분 B-option)

| 함수 | 치환 전략 | 이유 |
|---|---|---|
| `convert(varchar(N), x, 121)` | call-site → `to_char(x, 'YYYY-MM-DD')` | `public.convert` 오버로드 불가 |
| `format(n, '00')` | call-site → `lpad(n::text, 2, '0')` | `public.format` 은 이미 존재하나 시그니처 충돌 |
| `getdate/isnull/dateadd/datediff` | shim 유지 | 충돌 없음 |

### §8.2 검증 계획

1. `SELECT public.getdate(), public.isnull(null, 'x'), public.dateadd('month', 1, now()::timestamp), public.datediff('day', now(), now() + interval '3 day');`
2. 애플리케이션 `npm run build` → TS 컴파일 통과.
3. 도메인별 스모크:
   - **admin/dashboard** (daily/weekly/monthly/completed/delayed) — `dateadd/datediff/getdate` 의존 최다.
   - **admin/calendar**, **ship/calendar** — `dbo.fn_get_maintenance_extension` 가 이미 `public.fn_get_maintenance_extension` 로 치환되었는지 재확인.
   - **ship/execution/all**, **ship/dashboard** — CTE 기반 재작성본이므로 §P2 치환 후 결과 row 수 회귀.
4. 성능 스모크: `EXPLAIN ANALYZE` 로 shim 함수 사용 쿼리의 `planning time / execution time` 이상치 감지 (volatile 오분류 시 planner 저하).

---

## §9. 사전 식별된 이슈 로그

### §9.1 silent bug: `data/inventory/loss/sets/route.ts`

- 변경: `a.lossNo = b.lossNo` → `a.loss_no = b.loss_no` (MERGE ON 절)
- 성격: 기능 버그 (T-SQL/PG 무관)
- 조치:
  1. 운영 DB에 중복 row 확인: `select vessel_no, loss_no, count(*) from loss group by 1,2 having count(*)>1;`
  2. 중복 있으면 `regist_date` 최신만 남기고 물리 삭제 or 논리 삭제 정책 결정.
  3. CHANGELOG에 `[bugfix-migration-side-effect]` 항목 추가.

### §9.2 whitespace drift: `admin/ships/[vesselNo]/section/update/route.ts`

- 배치 Agent 3가 L18-19 trailing space를 편집기에서 drop 한 건. cosmetic.
- 조치: 프로젝트 `.editorconfig` 또는 prettier가 있다면 `trim_trailing_whitespace = true` 가 적용되어 있는지만 확인. 별도 수정 불필요.

### §9.3 `admin/ships/[vesselNo]/maintenance/route.ts` — 트리 빌더 하자

- `vessel.id = item.machine_name` (L78) — **vessel id에 machine_name 을 쓰는 것**은 명백히 버그. vessel 수준 식별자는 `vessel_no` 여야 한다.
- `section.children.push(item)` (L150, L199) — `maintenance.children = []` 가 L198 에만 있고 L150 케이스에는 없음 → `type:'TASK'` 노드의 children 스키마 불일치.
- **marker**: 이는 본 마이그레이션과 무관한 기존 결함이지만, 리팩터 권고 1순위다. 별도 이슈 티켓 생성 권장.

### §9.4 `receive` 테이블 Merge — 컬럼 네이밍 confuse

- `data/inventory/adjustment/receive/set/route.ts` 의 using 블록이 `@adjustmentNo as receive_no`, `@adjustmentDate as receive_date` 처럼 **adjustment 데이터를 receive 테이블에 기록**하는 구조. 스키마 설계 의도 재확인 요망 (adjustment vs receive 테이블 통합 여부, `receive_type` enum 값 문서화).

---

## §10. 런타임 회귀 테스트 매트릭스 (qa)

| 도메인 | 엔드포인트 샘플 | 검증 포인트 | §P2 의존 | MERGE 의존 |
|---|---|---|:-:|:-:|
| 로그인 | `/api/common/users/login` | 기본 인증 | - | - |
| 선박 목록 | `/api/common/ships/all`, `/api/admin/ships/all` | `[user]` → `"user"` 적용 확인 | - | - |
| 대시보드(관리자) | `/api/admin/dashboard/{daily,weekly,monthly,completed,delayed}` | 날짜 집계 정확성 | ✅ | - |
| 대시보드(선박) | `/api/ship/dashboard` | CTE 재작성본 row count | ✅ | - |
| 캘린더 | `/api/admin/calendar`, `/api/ship/calendar` | `public.fn_get_maintenance_extension` | ✅ | - |
| 정비 조회 | `/api/admin/ships/[vesselNo]/maintenance` | 트리 빌더 (§9.3) | ✅ | - |
| 정비 저장 | `.../maintenance/save`, `.../maintenance/insert` | MERGE 좌변 alias 제거 후 | - | ✅ |
| Section/Equipment 저장 | `.../section/save`, `.../equipment/save` | 동일 | - | ✅ |
| Execution 실행 | `/api/ship/execution/insert`, `/insert`s, `/all` | §P2 다수 | ✅ | - |
| Inventory — Warehouse | `/api/ship/inventory/warehouse/{insert,update,delete}` | **§7.2 대괄호 미수정** | ✅ | - |
| Inventory — Receive/Loss | `/api/data/inventory/{receive,loss}/sets` | Beta 패턴 + 버그 수정 | ✅ | ✅ |
| Scheduler | `/api/scheduler/{send,receive}` | 호환 레이어 + MERGE | ✅ | ✅ |
| Upload | `/api/admin/ships/[vesselNo]/upload`, 각 material upload | 대용량 MERGE 배치 | ✅ | ✅ |

각 도메인은 smoke → integration → load 3단계로. smoke는 1-request happy path, integration은 실제 UI 플로우, load는 upload/schedulr 대상.

---

## §11. 우선순위 로드맵

| 단계 | 작업 | 예상 소요 | 의존 |
|---|---|---|---|
| **P0** | §7.2 활성 8파일 치환 + §5 좌변 alias 제거 | 1-2h | - |
| **P0** | §8 호환 레이어 DDL 배포 | 30m + 테스트 30m | 마이그레이션 채널 |
| **P1** | `npm run build` → TS 통과 확인 | 10m | P0 |
| **P1** | 도메인별 smoke test (§10) | 2-3h | P0, P1 |
| **P2** | §9.1 silent bug 데이터 검증 (`loss` 중복) | 30m | P0 배포 후 |
| **P2** | §3 주석 cosmetic 정리 | 15m | - |
| **P3** | §4.3 (B)-option per-site 치환 sprint (도메인 5회) | 각 1일 × 5 | P1 통과 |
| **P3** | §9.3 트리 빌더 리팩터 | 0.5-1일 | 별도 이슈 |

---

## §12. 완료 기준(Definition of Done)

- [ ] `rg` 5종(§7.3) 모두 0 건.
- [ ] `npm run build` 통과.
- [ ] §10 매트릭스 smoke 15/15 통과.
- [ ] §8 shim 함수 6종 RDS 반영 및 `MD/00.Build/BUILD_AND_DEPLOY.md` 섹션 추가.
- [ ] §9.1 `loss` 테이블 중복 데이터 정책 결정·실행.
- [ ] CHANGELOG 및 migration note 업데이트 (이 문서 링크).

---

## 부록 A. grep 요약(2026-04-21 기준)

```
legacy mssql       : 0 files
§7.2 bracket active: 8 files / 13 occurrences  (common 2, ship/warehouse 3, data 3)
§7.2 bracket comment: 2 files                   (dashboard, execution/all — cosmetic)
dbo.fn_ / dbo.usp_ : 2 files (comment-only)
EXEC               : 0 files
§P2 deferred       : 96 files / 671 occurrences
MERGE              : 25 files
```

## 부록 B. 선행·관련 문서

- `MD/01.Migrate/REMAINING_MIGRATION_ANALYSIS.md` — 배치 착수 직전 스냅샷 (본 문서의 선행본)
- `MD/00.Build/BUILD_AND_DEPLOY.md` — 배포 플레이북 (§8 배포 시 갱신 대상)
- `db/index.ts` — `withTransaction` / `adaptNamedParams` / `query` / `execute` 현행 시그니처 정의
