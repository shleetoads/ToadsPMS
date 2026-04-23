# ToadsPMS — MSSQL → PostgreSQL 잔여 마이그레이션 심층 분석

> **작성 목적**: 다른 세션/다른 사람이 이 문서 하나만 보고 **어느 파일을 어떤 순서로 어떻게** 고쳐야 하는지 알 수 있게 한다.
> **작성 시점**: 2026-04-21 (dashboard 6파일 배치 완료 직후)
> **대상 범위**: `E:\Resources\ToadsPMS\app\api\**\route.ts`
> **검토 관점**: analyzer · backend · architect · qa · data

---

## §0. 30초 요약

| 지표 | 수치 | 비고 |
|---|---|---|
| 전체 API 라우트(대략) | 129 | `@/db` import 기준 |
| **빌드 차단(Blocker)** | **3 파일** | `getSql` import — 현재 `db/index.ts`에 해당 export 없음 → TS 컴파일 실패 |
| §7.2 실행 경로 위반 | **87 파일** | dashboard 6파일 완료 후 잔량 |
| `dbo.fn_*` 함수 호출 | 12곳 (실행 경로) | `fn_get_user`, `fn_get_maintenance_extension` |
| `EXEC dbo.usp_*` 프로시저 호출 | 1 파일 | `ship/equipmentRuntime/insert` |
| `MERGE … AS a` T-SQL 문 | 9 파일 | scheduler, upload, material, all/set |
| §P2 지연 대상(`getdate/dateadd/datediff/isnull/convert/format`) 포함 | 91 파일 / 588 occurrences | 런타임 호환 레이어 필수 |
| Beta 패턴(`withTransaction`) 이미 적용 | 18 파일 | 참고 패턴 문서화됨 |
| 예상 총 소요 | **12~18h** (주 저자 1인 기준) | §6 참조 |

**결론: 현재 상태에서 `npm run build`는 실패한다**. §1의 3파일이 가장 먼저다. 그다음 §P2 호환 레이어 도입 여부를 결정해야 §7.2 기계적 치환 범위가 확정된다.

---

## §1. 빌드 차단(Blocker) — 최우선 수정 대상

`db/index.ts`가 export하는 심볼:

```
getPool, adaptNamedParams, NamedParam, query, execute,
queryWithClient, executeWithClient, withTransaction
```

`getSql`는 **export 되지 않는다**. 따라서 아래 3파일은 `import { getSql, getPool } from '@/db'` 시점에서 TS2305 에러로 빌드가 실패한다.

| # | 파일 | LOC | MERGE 블록 수 | 추정 난이도 |
|---|---|---:|---:|---|
| 1 | `app/api/data/inventory/receive/sets/route.ts` | 118 | 1 | ★★☆☆☆ |
| 2 | `app/api/data/inventory/loss/sets/route.ts` | 113 | 1 | ★★☆☆☆ |
| 3 | `app/api/data/all/set/route.ts` | **1074** | **12** | ★★★★★ |

### §1.1 공통 증상

```ts
import { getSql, getPool, query, execute } from '@/db';   // ← getSql 없음
const sql = await getSql();
const pool = await getPool();
const transantion = pool.transaction();                    // ← pg Pool에 없음
await transantion.begin();
const request = new sql.Request(transantion);              // ← mssql-only
params?.forEach(p => request.input(p.name, p.value));      // ← mssql-only
count += result.rowsAffected[0];                           // ← pg는 rowCount
transantion.commit();  /  transantion.rollback();
```

### §1.2 치환 레시피(Beta 패턴)

기존 패턴:
```ts
const pool = await getPool();
const transantion = pool.transaction();
await transantion.begin();
for (const item of items) {
  const request = new sql.Request(transantion);
  params.forEach(p => request.input(p.name, p.value));
  const result = await request.query(sqlText);
  count += result.rowsAffected[0];
}
transantion.commit();
```

→ 치환 패턴:
```ts
import { withTransaction, adaptNamedParams } from '@/db';

const count = await withTransaction(async (client) => {
  let n = 0;
  for (const item of items) {
    const { text, values } = adaptNamedParams(sqlText, params);
    const result = await client.query(text, values);
    n += result.rowCount ?? 0;
  }
  return n;
});
```

### §1.3 파일별 주의점

- **`data/all/set/route.ts` (1074 LOC, 12 MERGE 블록)**
  - 단일 트랜잭션 안에서 12개 테이블을 순차 MERGE 한다. `withTransaction` 한 번으로 래핑하되, 12개 블록 각각의 `for` 루프를 내부에 그대로 둔다.
  - MSSQL `MERGE … WHEN MATCHED … WHEN NOT MATCHED` 문법은 PostgreSQL 15+에서 지원되므로 SQL 본문은 대부분 그대로 유지 가능 (단 §7.2 대괄호 제거는 필요).
  - 다만 `OUTPUT` 절이 있으면 PG `MERGE`에서는 미지원 → `INSERT … ON CONFLICT DO UPDATE RETURNING` 대체 필요. **확인 필요**(grep 결과 `output inserted/deleted` 0건 → 영향 없음 추정).
- **`data/inventory/receive/sets`, `…/loss/sets`**: 각각 단일 MERGE. 동일 패턴 적용. 2파일은 1시간 내 종료 가능.

### §1.4 검증

```bash
# 배치 후
grep -rE "getSql|pool\.transaction|\.rowsAffected|new sql\.Request|transantion|\.recordset|request\.input" app/api
# 기대: 0건
npm run build   # 최소 이 3파일로 인한 TS 에러는 사라져야 함
```

---

## §2. §7.2 정적 치환 — 87 파일

> **규칙**: `[테이블]` 대괄호 제거, `dbo.fn_*` → `public.fn_*`, `EXEC dbo.usp_*` → `CALL usp_*`.

### §2.1 전사 현황 (디렉토리별, dashboard 제외)

| 디렉토리 | 파일 수 | 주요 위반 유형 |
|---|---:|---|
| `ship/section/*` | 4 | `[section]`, `[vessel]` |
| `ship/maintenance/**` | 12 | `[maintenance_plan]`, `[vessel]`, `[equipment]`, `dbo.fn_get_user`, `dbo.fn_get_maintenance_extension` |
| `ship/inventory/**` | 9 | `[inventory*]`, `[material]`, `[receive]`, `[release]`(예약어 주의), `dbo.fn_get_user` |
| `ship/equipment/*` | 4 | `[equipment]`, `[vessel]` |
| `ship/calendar/route.ts` | 1 | `dbo.fn_get_maintenance_extension` |
| `ship/execution/**` | 2 | `[inventory]` 등 |
| `ship/extension/insert` | 1 | `[maintenance_extension]` |
| `ship/equipmentRuntime/insert` | 1 | **`EXEC dbo.usp_upsert_equipment_runtime`** (§3 참조) |
| `admin/ships/[vesselNo]/**` | 24 | ship/** 거울 구조 |
| `admin/ships/*` (상위) | 5 | `[vessel]`, `[user]` |
| `admin/maintenance/**` | 7 | `dbo.fn_get_maintenance_extension`, `dbo.fn_get_user` |
| `admin/inventory/**` | 8 | `[inventory*]`, `dbo.fn_get_user` |
| `admin/users/*` | 4 | `[user]`(예약어 주의) |
| `admin/calendar/route.ts` | 1 | `dbo.fn_get_maintenance_extension` |
| `data/**` (set, get) | 7 | `[maintenance_plan]`, `[section]`, `[equipment]`, `[extension]` |
| `common/*` | 4 | `[section]`, `[equipment]`, `[position]`, `[vessel]` |
| **합계** | **~87** | — |

### §2.2 PostgreSQL 예약어 주의 — `release`, `user`

대괄호만 벗기면 PG 파서가 예약어로 해석해 실패한다. `"release"`, `"user"` 큰따옴표로 감싸야 한다 (기 합의된 규칙).

| 예약어 테이블명 | 영향 파일 |
|---|---|
| `release` | `data/inventory/adjustment/release/set/route.ts` 등 (grep 시 `\[release\]` 매치 필요) |
| `user` | `admin/users/{all,insert,update,changePassword}/route.ts` (4) |

> 주의: grep pattern `\[release\]\|\[user\]` 매치는 23파일로 나오지만 이 중 상당수는 `[vessel_user]`, `[release_seq]` 같은 토큰 경계 없이 매칭된 false-positive 포함 가능. **실제 치환 시 컬럼/테이블 문맥 재확인 필수**.

### §2.3 `dbo.fn_*` 치환 (12건)

| 함수 | 파일 | 비고 |
|---|---|---|
| `fn_get_maintenance_extension` | `ship/calendar`, `admin/calendar`, `admin/maintenance/route`, `ship/execution/all`(주석 내) | CTE 인라인화 필요 여부 검토(§5) |
| `fn_get_user` | `admin/inventory/transactions`, `ship/inventory/transactions`, `admin/inventory/loss`, `ship/maintenance/extension`(×2), `admin/maintenance/extension`(×2) | PG에 `public.fn_get_user` 존재 가정 |

**설계 주의 (architect 관점)**: `fn_get_maintenance_extension(vessel_no, equip_no, section_code, plan_code)`는 `maintenance_extension` 최신 row를 fetch하는 스칼라 함수로 보인다. `ship/dashboard/route.ts`가 최근 이 로직을 CTE(`LatestExtension` + `ROW_NUMBER() OVER PARTITION BY`)로 인라인화했다. `admin/maintenance`, `calendar` 2파일도 동일 패턴으로 리팩토링 가능성 높음 — 함수 의존성 제거 시 RDS 측 함수 배포/관리 부담 감소. 단기로는 `public.fn_*` 치환, 중기로는 인라인화 평가를 권장한다.

### §2.4 치환 자동화(선택)

```bash
# dry-run: 실행 경로만 매칭 (주석 제외)
rg -n '^(?!.*//).*(\[(vessel|equipment|section|maintenance_plan|maintenance_extension|inventory|material|receive|user|release)\]|dbo\.(fn_|usp_))' app/api
```

> **QA 관점**: sed 일괄 치환은 금지. 파일별로 Edit 툴 단위로 최소 변경 + grep 재검증 후 commit 하는 기존 배치 방식 유지. 대괄호 안 토큰이 컬럼명(`[type]`, `[status]`, `[order]`)일 때 영향 범위가 달라 정규식 일괄 치환이 위험하다.

---

## §3. 저장 프로시저 호출 — `EXEC dbo.usp_*`

| 파일 | 프로시저 | 인자 |
|---|---|---|
| `ship/equipmentRuntime/insert/route.ts` | `usp_upsert_equipment_runtime` | `@vessel_no, @machine_name, @equip_no, @equip_name, @runtime` |

**치환**: T-SQL `EXEC dbo.usp_x @a, @b` → PG `CALL usp_x(@a, @b)` (`CALL` 구문은 PG11+). `@vessel_no` 등은 `adaptNamedParams`가 `$1, $2...`로 변환한다.

단, 실제 PG 측에 `usp_upsert_equipment_runtime` 프로시저가 마이그레이션되어 있는지 **DBA 확인 필요**. 부재 시 `INSERT … ON CONFLICT (vessel_no, equip_no, machine_name) DO UPDATE …` 인라인화로 대체.

---

## §4. `MERGE` 문 — 9 파일 / 22 블록

| 파일 | MERGE 블록 |
|---|---:|
| `scheduler/receive/route.ts` | 7 (vessel/equipment/section/maintenance_plan/maintenance_extension/material/receive) |
| `admin/ships/[vesselNo]/upload/route.ts` | 4 (machine/equipment/section/maintenance_plan) |
| `admin/inventory/material/upload/route.ts` | 2 (material/receive) |
| `admin/inventory/material/update/route.ts` | 1 |
| `admin/inventory/material/insert/route.ts` | 1 |
| `ship/inventory/material/upload/route.ts` | 2 |
| `ship/inventory/material/update/route.ts` | 1 |
| `ship/inventory/material/insert/route.ts` | 1 |
| `data/inventory/material/set/route.ts` | 2 |
| `data/all/set/route.ts` | 12 (§1에 포함) |

### §4.1 PG MERGE 호환성 (PG 15+)

PG 15 이상은 `MERGE INTO t USING s ON … WHEN MATCHED THEN … WHEN NOT MATCHED THEN …`를 지원하므로 **대부분 문법 그대로 유지** 가능. 단 다음은 PG 미지원 → 치환 필요:
- `OUTPUT INSERTED/DELETED` — 현재 코드 grep 결과 0건 (영향 없음).
- T-SQL 특정 함수 내장(`getdate()`, `isnull()`, `dateadd()` 등) — §P2와 함께 처리.

### §4.2 대안: `INSERT … ON CONFLICT DO UPDATE`

PG 14 이하 호환 또는 더 안전한 단일 테이블 upsert는 `INSERT … ON CONFLICT (pk) DO UPDATE SET …` 로 치환하는 편이 표준이다. 다만 `WHEN NOT MATCHED BY SOURCE THEN DELETE` 같은 3-way 로직이 포함되면 MERGE가 필요. 각 블록 검토 후 선택.

---

## §5. §P2 지연 대상 — T-SQL 전용 스칼라 함수

> **기존 합의**: `getdate/dateadd/datediff/isnull/convert/format/+concat/merge` 는 1차 마이그레이션에서 **그대로 둔다**(Phase 2).

### §5.1 현황

91 파일 / 588 occurrences. 비중이 큰 파일:

| 파일 | 건수 |
|---|---:|
| `ship/dashboard/route.ts` | 38 |
| `admin/maintenance/route.ts` | 10 |
| `data/all/set/route.ts` | 25 |
| `admin/ships/[vesselNo]/upload/route.ts` | 12 |
| `scheduler/receive/route.ts` | 14 |
| `scheduler/send/route.ts` | 11 |
| `ship/calendar/route.ts` | 11 |
| `admin/calendar/route.ts` | 11 |
| `ship/execution/all/route.ts` | 47 |
| `admin/dashboard/*/route.ts` | 14~15 (×5) |

### §5.2 두 가지 전략

**A. DB 측 호환 함수 배포** (권장, 변경량 최소):
```sql
CREATE OR REPLACE FUNCTION public.getdate() RETURNS timestamp LANGUAGE sql STABLE AS
$$ SELECT current_timestamp::timestamp $$;
CREATE OR REPLACE FUNCTION public.isnull(anyelement, anyelement) RETURNS anyelement …;
-- dateadd / datediff / convert / format 은 파라미터 overload 주의
```
- 장점: API 소스는 거의 그대로. 회귀 위험 최소.
- 단점: `dateadd(month, n, d)` 첫 인자 `month`가 **식별자**로 해석됨 → 문자열 리터럴로 감싸거나(`'month'`) 파서 호환 함수를 여러 overload로 만들어야 함. 실용상 `dateadd_month(n, d)` 같은 래퍼 함수를 도입하고 SQL 텍스트를 sed로 정규화하는 편이 단순.

**B. SQL 텍스트 일괄 치환**:
- `getdate()` → `current_timestamp`
- `isnull(a, b)` → `coalesce(a, b)`
- `dateadd(month, n, d)` → `(d + (n || ' month')::interval)` 또는 `d + make_interval(months => n)`
- `datediff(day, a, b)` → `(b::date - a::date)`
- `convert(varchar(10), d, 23)` → `to_char(d, 'YYYY-MM-DD')`
- 장점: DB 함수 관리 불요, 표준 SQL.
- 단점: 588곳 편집, 회귀 위험, `case interval_term when 'HOURS' then dateadd(day, interval/24, lastest_date)` 같은 복합식 수작업 필요.

### §5.3 권장

1. **우선 A안으로 런타임 부팅 확보** → 기능 스모크 테스트
2. **안정화 후 B안을 파일 배치별로 병행** (dashboard는 이미 수작업으로 상당 부분 PG-native 구성 완료)

**data 관점**: `convert(varchar(10), d, 121)` (ODBC canonical `YYYY-MM-DD HH:MM:SS.mmm`)과 `, 23` (`YYYY-MM-DD`)은 포맷이 다르다. 일괄 치환 시 두 포맷 구분 유지 필요. 프론트 파서가 둘 중 어느 쪽에 의존하는지 확인하지 않으면 날짜 표시 회귀 발생 가능.

---

## §6. 배치 분할 및 일정

> 커밋 단위 = 배치 = 롤백 지점. 각 배치 끝 `grep` 검증 → `npm run build` → commit.

| # | 배치 | 파일 수 | 예상 소요 | 의존성 |
|---:|---|---:|---:|---|
| **B1** | **Blocker 제거** — `data/inventory/{receive,loss}/sets`, `data/all/set` | 3 | 3~4h | **선행 필수** |
| B2 | `common/*` | 4 | 0.5h | B1 후 |
| B3 | `admin/users/*` + `[user]` 예약어 | 4 | 1h | — |
| B4 | `admin/ships/*` (상위 5) | 5 | 1h | — |
| B5 | `admin/ships/[vesselNo]/**` (24) | 24 | 3h | B4 |
| B6 | `admin/maintenance/**` + `admin/calendar` | 8 | 1.5h | — |
| B7 | `admin/inventory/**` | 8 | 1.5h | — |
| B8 | `ship/section/*` + `ship/equipment/*` | 8 | 1h | — |
| B9 | `ship/maintenance/**` + `ship/extension/insert` | 13 | 2h | — |
| B10 | `ship/inventory/**` + `ship/execution/**` + `ship/calendar` | 12 | 2h | — |
| B11 | `ship/equipmentRuntime/insert` (§3 프로시저) | 1 | 0.5h | DBA 확인 |
| B12 | `data/**` 나머지 + `scheduler/**` | 8+ | 2h | B1 후 |
| B13 | §P2 호환 레이어 (A안) 배포 + 스모크 테스트 | — | 1h | 전체 후 |
| — | **합계** | **~88** | **~19h** | |

**QA 관점**: 각 배치 끝에 최소 curl 스모크 1건 (GET 200 또는 POST 200) 기록 권장. 회귀 판별용 bronze-tier 체크.

---

## §7. 위험 요소 및 오픈 이슈

### §7.1 예약어 토큰 오탐

- `\[release\]|\[user\]|\[order\]|\[level\]|\[desc\]|\[type\]|\[name\]|\[status\]` grep은 23파일 매칭되나 상당수는 `[vessel_user]`, `[release_seq]` 같은 **식별자 일부 매칭**이다. 실제 §2.2 큰따옴표 래핑 대상은 수동 확인 필요.

### §7.2 `MERGE` 문의 `getdate()` 등 §P2 의존

- §4의 9 MERGE 파일은 대부분 `getdate()`, `isnull()`을 USING/ON/WHEN 절에서 사용. §5 A안 호환 함수 우선 배포 시 안전. B안만 쓰면 MERGE 재작성 동반.

### §7.3 `release`라는 이름의 테이블/컬럼

- `data/inventory/adjustment/release/set/route.ts` 경로에서 암시 — 실제 테이블 또는 컬럼명인지 스키마 확인 필요. PG 예약어는 아니지만 일부 SQL 파서에서 주의.

### §7.4 런타임 `usp_upsert_equipment_runtime` 부재 가능성 (§3)

- RDS 측 마이그레이션 DDL 체크리스트에 `public.fn_get_user`, `public.fn_get_maintenance_extension`, `public.usp_upsert_equipment_runtime` 3개 존재 여부 재확인 필요.

### §7.5 `data/all/set/route.ts` 단일 트랜잭션 12 MERGE

- 한 요청 안에서 12 테이블을 갱신. 네트워크/타임아웃/메모리 회귀 위험. 마이그레이션 때 `statement_timeout` 상향 또는 커밋 분리 여부 판단 필요. Architect 관점에서 기능 변경 없이 `withTransaction` 그대로 1:1 이식 권장 (성능/일관성 이슈는 후속 별도 태스크).

---

## §8. 완료 판정 기준 (Definition of Done)

다음 **모두** 통과해야 잔여 마이그레이션 완료:

1. ```bash
   grep -rE "getSql|pool\.transaction|\.rowsAffected|new sql\.Request|transantion|request\.input|\.recordset" app/api
   # 기대: 0 match
   ```
2. ```bash
   grep -rnE "^(?!.*//).*(\[(vessel|equipment|section|maintenance_plan|maintenance_extension|inventory|material|receive|release|user)\]|dbo\.(fn_|usp_)|EXEC\s+dbo\.)" app/api
   # 기대: 0 match (주석 제외 실행 경로)
   ```
3. `npm run build` 에러 0.
4. §5 A안 호환 함수 PG에 배포됨 (또는 B안으로 585+개 occurrences 치환 완료).
5. 스모크 테스트: 각 도메인(ships, maintenance, inventory, dashboard, execution, calendar) 최소 1 GET + 1 POST 200.
6. 회귀 로그: 각 배치 커밋 메시지에 grep diff 결과 첨부.

---

## §9. 부록 — 참고 기 적용 파일 (Beta 패턴 예시)

다음 18파일은 이미 `withTransaction` + `adaptNamedParams` 패턴이 적용돼 있어 스타일 참조용.

```
data/inventory/material/set/route.ts
data/execution/{set,sets}/route.ts
admin/ships/[vesselNo]/maintenance/execution/update/route.ts
admin/ships/[vesselNo]/upload/route.ts
admin/inventory/material/{upload,update,insert,delete}/route.ts
ship/execution/{insert,inserts}/route.ts
ship/inventory/{loss/insert, receive/insert}/route.ts
ship/inventory/material/{update,insert,upload}/route.ts
scheduler/{receive,send}/route.ts
```

특히 §1의 3파일 치환 작업 시 `data/execution/set/route.ts`가 가장 유사한 for-loop + MERGE + `withTransaction` 패턴이므로 **복사 기반 템플릿**으로 사용 가능.

---

## §10. 다음 한 발

가장 안전하고 효과가 큰 단일 액션:

> **`data/inventory/receive/sets/route.ts` 1개만 먼저 Beta 패턴으로 치환하여 커밋** → `grep -c "getSql|transantion" app/api` 감소 확인 → 동일 패턴을 `loss/sets`와 `all/set`에 순차 적용. §1이 끝나면 빌드가 깨끗해지므로 이후 §2 배치는 안전망 위에서 진행할 수 있다.

— 끝 —
