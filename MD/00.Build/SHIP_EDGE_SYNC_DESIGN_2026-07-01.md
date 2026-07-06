# 선상 엣지 ↔ 중앙 클라우드 동기화 — 상세 설계

> 작성일: 2026-07-01
> 문서 유형: 시스템/컴포넌트/DB/API 상세 설계 (`/sc:design` 산출물)
> 상위 문서: [SHIP_EDGE_SYNC_ARCHITECTURE_2026-07-01.md](SHIP_EDGE_SYNC_ARCHITECTURE_2026-07-01.md) (요구·결정 확정본)
> 상태: **설계 초안** — 승인 후 `/sc:implement`로 구현

---

## 0. 설계 범위

| # | 설계 대상 | 절 |
|---|-----------|-----|
| D1 | 동기화 프로토콜 + 워터마크(change_seq) 스키마 | §3, §4 |
| D2 | 노드 토큰 인증 게이트웨이(middleware) | §5 |
| D3 | 소프트 삭제 전파 | §4.2, §6 |
| D4 | `user` 하향 동기화(오프라인 로그인) | §7 |
| D5 | 회선 감지 트리거 | §8 |
| D6 | 엣지 배포 패키지(Next.js + 로컬 Postgres) | §9 |
| 부수 | DB 연결 강건화(GAP-7), API 명세, 마이그레이션, 파일 변경지도 | §10~§13 |

**설계 원칙(상위 문서 계승):** 선박 능동 발신 고정 · 오프라인 우선 · 동일 이미지(역할은 `NODE_ROLE`) · 소유권 기반 단방향화. **시계 비의존**을 새 핵심 원칙으로 추가(§3.1).

---

## 0.1 검증 결과 정정 (2026-07-01) — 필독

초안 검증에서 핵심 가정 2개가 무효화되어 아래를 정정한다.

| ID | 검증 결과 | 정정 |
|----|-----------|------|
| **F1 (심각)** | 재사용 예정이던 **MERGE UPSERT가 이미 PostgreSQL에서 500** (MSSQL 문법 `merge X as a using…`, `INTO` 없음). 근거: BUILD_AND_DEPLOY §12-6("MERGE… 로그인 외 라우트 현재 500", P2 미해결), "MERGE alias LHS 23파일". `009_tsql_shim`은 함수만 채우고 MERGE 문법은 못 고침 | 모든 upsert를 **`INSERT … ON CONFLICT (pk) DO UPDATE`**(PG9.5+)로 재작성. 기존 MERGE 재사용 금지. `data/*` 재사용이 아니라 **신규 `/api/sync/*`를 ON CONFLICT로 신규 작성**(§3.4, §11) |
| **F2 (결함)** | `change_seq` 트리거가 **수신 적용 시에도 발화** → 받은 행이 자기 델타에 재진입. 양방향 `maintenance_extension`에서 핑퐁 | 수신 트랜잭션에서 `SET LOCAL app.sync_apply='on'`, 트리거가 이 플래그면 seq **미부여**(§4.1) |
| **F5 (결정필요)** | 현재 **선박용 마스터 입력 라우트 존재**: `warehouse`=선박, `material`/`equipment`/`section`=양쪽. 결정 Q5("선박 마스터 편집 없음")와 모순 | **결정 필요(§13-R7):** 선박측 마스터 입력 라우트 비활성 vs 해당 테이블 양방향 승격. 확정 전 §1.2 방향표는 잠정 |
| F3/F4 (확인) | `user`엔 `last_send/receive_date` 없음, 선박 insert는 `modify_date`도 미기입 | **트리거 기반 change_seq 설계가 옳음** — insert 라우트 무수정으로 흡수 |
| F6 (확인) | `next.config.mjs` `output:'standalone'`, Next 15.5 instrumentation stable | `register()` 자동 호출. 구현 시 1회 확인 |

### 0.2 2차 검증 (2026-07-01, R7=②·R9=a 결정 후)

| ID | 검증 결과 | 정정/반영 |
|----|-----------|-----------|
| **V3 (중요)** | **온보딩 시드 누락** — 기존 vessel(이미 클라우드 이력 보유)에 새 엣지 투입 시, 정상 download는 upload-소유 테이블(work/used_parts/receive/release/loss)을 **제외**하므로 과거 정비·재고 이력이 안 내려감 | §9.2에 **부트스트랩 전용 풀-익스포트**(전 13T, 방향 무시) 단계 추가 |
| **V2 (프로토콜)** | download 커서는 **수신한(vessel 필터된) 행의 max(change_seq)** 로만 전진해야 함. 중앙 전역 max로 전진 시 타 vessel seq에 밀려 **자기 vessel 행 스킵** 위험 | §3.3 커서 전진 규칙 명시 |
| **V4 (R9-a 완전성)** | 생성 우회로 발견 — `*/save`가 **MERGE upsert**로 WHEN NOT MATCHED에서 `equip_no=MAX()+1` **생성**([equipment/save:44](../../app/api/ship/equipment/save/route.ts)). `/insert`만 막으면 불충분 | §12: 엣지에서 `/save`의 **생성 분기도 차단**(수정 분기만 허용) |
| **V6 (F1 정밀화)** | MERGE 영향범위 특정: `*/save` 업서트 + 전 `/data/*/set` + `scheduler/receive`가 500. **평문 UPDATE/INSERT 라우트(예 [equipment/update](../../app/api/ship/equipment/update/route.ts))는 정상**. → 마스터 **편집(update)은 오늘도 동작** → R7② "수정 양방향" 기능적 실현 가능 | 코어(sync 수신)만 ON CONFLICT 필수. `/save` 정리는 R9-a와 함께 |
| **V1 (문서정합)** | §11.1 upload 예시가 양방향 마스터(equipment/section/material/warehouse)를 누락 | §11.1 rows 보강 |
| **V5 (소프트삭제)** | 물리삭제 라우트 존재([warehouse/delete](../../app/api/ship/inventory/warehouse/delete/route.ts)) → 소프트삭제로 전환 대상 | P1.5 범위 확인 |
| ✅ P-a | 마스터 편집 라우트(`equipment/section/material/warehouse/update`) 실재 + 평문 UPDATE | R7②·R9a 실현 가능성 입증 |
| **V8 (버전)** | **RDS 실측 = PostgreSQL 17.9** (초안 15 가정 오류). 엣지도 17 정렬 필요 | §9.1 compose `postgres:17`로 정정 |
| ✅ V9 (P0 실증) | 로컬 PG17.10 + 프로덕션 스키마(49T) 재현 후 011~014 적용·**트리거 3종 통과**(정상부여/`sync_apply` 억제/update부여), F1(MSSQL MERGE) PG17에서 syntax error 실증 | P0 DB 계층 검증 완료 |

---

## 1. 아키텍처 개요

### 1.1 노드 역할 분기 (`NODE_ROLE`)
동일 Docker 이미지, 환경변수로 역할 결정.

| 변수 | 중앙(central) | 엣지(edge) |
|------|---------------|------------|
| `NODE_ROLE` | `central` | `edge` |
| `DB_HOST` | RDS | 로컬 컨테이너 `db` |
| `VESSEL` | (비움 — 전 선박) | 해당 선박 1척 (예: `DSRJ2`) |
| `REMOTE_SITE_URL` | (비움) | `https://pms.toads.kr` |
| `NODE_ID` / `NODE_TOKEN` | — | 노드별 발급 |
| 연결 감시자 | 미기동 | 기동 |
| 인증 게이트웨이 | `/api/data/*`·`/api/sync/*` 요청 검증 | 요청에 토큰 부착 |

> **불변식:** 중앙은 절대 엣지로 접속을 개시하지 않는다. 모든 동기화는 엣지 → 중앙 outbound.

### 1.2 동기화 대상 테이블 (13개)
`vessel, equipment, section, maintenance_plan, maintenance_extension, maintenance_work, used_parts, warehouse, material, receive, "release", loss, "user"`

> **스코프 확정(2026-07-01): 엣지는 자기 선박 1척(`VESSEL`)의 데이터만 보유·수신한다.** 회사 전체 데이터를 내려받지 않음. 모든 다운로드 델타는 `vessel_no = :VESSEL`로 스코프한다. **예외 주의: `user`는 `vessel_no`가 없고 `ship_no`(FK)만 있으므로 `ship_no = :VESSEL`로 필터**해야 한다(§7). 미필터 시 회사 전체 계정·비밀번호 해시가 전 선박에 복제되는 스코프·보안 위반.

방향(소유권) — **R7=② 양방향 확정(2026-07-01).** `equipment`/`section`/`material`/`warehouse`는 엣지·중앙 양쪽 수정 → 충돌 해소(§3.5)와 ID 충돌 대응(§13-R9) 필요. 선박측 마스터 입력 라우트는 **유지**:

| 방향 | 테이블 |
|------|--------|
| 엣지 → 중앙 (upload only) | `maintenance_work`, `used_parts`, `receive`, `release`, `loss` |
| 중앙 → 엣지 (download only) | `vessel`, `maintenance_plan`, `user` |
| **양방향 (bidirectional)** | `equipment`, `section`, `material`, `warehouse`, `maintenance_extension`(필드분리: 신청=엣지/승인=중앙) |

---

## 2. 현행 대비 설계 변경 요약

| 영역 | As-Is | To-Be |
|------|-------|-------|
| 델타 기준 | `modify_date`(로컬 시계) 비교 | **`change_seq`(DB 시퀀스, 단조증가)** — 시계 비의존 |
| 커서 | 테이블별 `last_send/receive_date` 산발 | **`sync_state` 커서 테이블**로 일원화 |
| 커버리지 | receive 병합이 일부 테이블 누락(GAP-2) | **13개 테이블 전량** 양방향 |
| 삭제 | 전파 불가(UPSERT만) | **소프트 삭제(`deleted_yn`) 전파** |
| 인증 | 없음(GAP-3) | **노드 토큰 게이트웨이(middleware)** |
| 트리거 | cron 주석(GAP-1) | **회선 감지 즉시** |
| 오프라인 로그인 | `user` 미동기화(GAP-10) | **`user` 하향 동기화** |
| 연결 안정성 | 타임아웃 없음(GAP-7) | **pool/statement 타임아웃** |

---

## 3. 동기화 프로토콜 설계 (D1)

### 3.1 워터마크 = DB 시퀀스 기반 change_seq (시계 비의존)
각 DB(엣지 로컬, 중앙 RDS)에 **독립적인 단조증가 시퀀스**를 두고, 동기화 대상 행이 insert/update될 때마다 트리거로 `change_seq`를 찍는다.

- 델타 조회 = `WHERE change_seq > :cursor` — **벽시계(wall-clock) 완전 배제** → GAP-8 근본 해소.
- 업로드 커서는 **엣지 시퀀스** 값을, 다운로드 커서는 **중앙 시퀀스** 값을 추적(서로 독립이라 충돌 없음).
- `modify_date`는 감사/표시용으로 유지하되 **동기화 판정에는 쓰지 않는다.**

### 3.2 커서 관리 — `sync_state`
엣지가 보유. (중앙은 vessel별로 엣지가 보내온 커서를 신뢰하므로 별도 상태 최소)

```
sync_state(
  peer            text,        -- 'central'
  direction       text,        -- 'upload' | 'download'
  last_seq        bigint,      -- 전송/수신 완료된 change_seq 상한
  last_success_at timestamp,
  PRIMARY KEY (peer, direction)
)
```

### 3.3 동기화 파이프라인 (엣지 주도, upload → download 순)

```
[엣지]  회선 감지(online 전이)
  │
  ├─(1) UPLOAD ─────────────────────────────────────────────►[중앙]
  │     POST /api/sync/upload
  │     헤더: Authorization, X-Node-Id, X-Vessel-No
  │     바디: { cursor: last_upload_seq, batch_id, rows:{table:[...]} }
  │                                        중앙: 소유권 검증→멱등 MERGE→커밋
  │◄──── 200 { ack_seq }  ────────────────────────────────────┤
  │     엣지: sync_state(upload).last_seq = 배치 max(change_seq)
  │
  ├─(2) DOWNLOAD ───────────────────────────────────────────►[중앙]
  │     POST /api/sync/download
  │     바디: { cursor: last_download_seq, vessel_no }
  │                            중앙: WHERE vessel_no=:v AND change_seq>cursor 델타 조회
  │                            (user만 ship_no=:v 로 필터 — 해당 선박 승선원 계정만)
  │◄──── 200 { rows:{...} } ──────────────────────────────────┤
  │     엣지: 멱등 upsert(소유권 필드만)
  │     → sync_state(download).last_seq = **수신 행들의 max(change_seq)**  (V2)
  ▼
 완료 (실패 시 지수 백오프 재시도, 커서 미전진 → 다음 회차 재전송)
```
> **V2 커서 규칙:** 다운로드 커서는 **실제 수신·적용한(=vessel 필터된) 행의 `max(change_seq)`** 로만 전진한다. 중앙의 전역 max/nextval로 전진하면 타 vessel의 높은 seq에 밀려 자기 vessel 행을 영구 스킵할 수 있다.

### 3.4 멱등성·원자성
- **멱등:** 모든 수신은 자연키(PK) 기준 **`INSERT … ON CONFLICT (pk) DO UPDATE`**(PG9.5+). 동일 배치 재전송해도 결과 동일. ⚠️ **기존 MSSQL `MERGE`는 PostgreSQL에서 500이므로 재사용 금지(F1).** 예:
  ```sql
  INSERT INTO equipment (vessel_no, equip_no, equip_name, …, last_receive_date, regist_date, regist_user, deleted_yn)
  VALUES (@vesselNo, @equipNo, @equipName, …, now(), @registDate, @registUser, @deletedYn)
  ON CONFLICT (vessel_no, equip_no) DO UPDATE SET
    equip_name = EXCLUDED.equip_name, …, last_receive_date = now(),
    modify_date = EXCLUDED.modify_date, deleted_yn = EXCLUDED.deleted_yn;
  ```
- **에코 차단:** 수신 트랜잭션 진입 시 `SELECT set_config('app.sync_apply','on', true);` 실행 → 트리거가 change_seq를 안 찍어 받은 행이 델타에 재진입하지 않음(F2).
- **원자성:** 수신측은 배치 전체 + 위 `set_config`를 하나의 `withTransaction`으로 감싼다(부분반영 금지).
- **커서 전진 규칙:** 엣지는 **상대 200 응답을 받은 뒤에만** `sync_state`를 전진(현행 "응답 ok 후 update" 패턴 계승). 중간 실패 시 커서 유지 → 다음 회차에 자동 재전송.
- `batch_id`(UUID) 헤더로 중앙 수신 로그 중복 판별(관측·디버깅용).

### 3.5 충돌 해소 (R7=② 양방향 대응)
양방향 테이블(`equipment`/`section`/`material`/`warehouse` + `maintenance_extension`)은 양쪽 동시 수정이 가능하므로 규칙이 필요하다. change_seq는 DB별 독립이라 노드 간 비교 불가 → **충돌 tiebreak는 `modify_date` 기준 LWW(Last-Write-Wins).**
- ON CONFLICT 갱신에 **가드**를 건다(오래된 수정본이 최신본을 덮지 않도록, 적용 순서 무관 수렴):
  ```sql
  ON CONFLICT (vessel_no, equip_no) DO UPDATE SET
    equip_name = EXCLUDED.equip_name, …, deleted_yn = EXCLUDED.deleted_yn,
    modify_date = EXCLUDED.modify_date, last_receive_date = now()
  WHERE EXCLUDED.modify_date >= equipment.modify_date;   -- 최신 수정본만 승리
  ```
- `maintenance_extension`은 **필드 분리**: 신청필드는 엣지 값만, 승인필드는 중앙 값만 반영(LWW 대신 소유권 우선).
- **시계 의존 최소화:** delta 탐지는 여전히 change_seq(시계 무관). `modify_date`는 **충돌 시에만** 사용. 엣지 HW에 NTP 강제(자체 설치·통제 Q2)로 오차 완화. 마스터는 변경 빈도가 낮아 실충돌 창이 작다.
- **동시 생성 ID 충돌은 별도 대응**(§13-R9) — LWW로 해결 안 됨(서로 다른 행이 같은 PK를 뽑는 문제).

---

## 4. 데이터 모델 변경 (DDL)

> 마이그레이션 파일은 기존 `009_`, `010_` 다음 번호로 부여. **엣지·중앙 양쪽 DB에 동일 적용.**

### 4.1 `011_sync_change_seq.sql` — 시퀀스 + 트리거

```sql
-- 데이터베이스별 단일 단조증가 시퀀스
CREATE SEQUENCE IF NOT EXISTS pms_change_seq;

-- 동기화 대상 13개 테이블에 change_seq 컬럼 + 트리거 부착
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

-- 공통 트리거 함수: insert/update 시 change_seq 자동 부여
-- 단, 수신 적용 중(app.sync_apply='on')이면 미부여 → 에코 루프 차단(F2)
CREATE OR REPLACE FUNCTION set_change_seq() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.sync_apply', true) = 'on' THEN
    RETURN NEW;   -- 원격 수신분: 로컬 델타에 재진입시키지 않음
  END IF;
  NEW.change_seq := nextval('pms_change_seq');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

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
  -- 기존 데이터 백필(최초 1회): 현재 행에 순번 부여
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('UPDATE %I SET change_seq = nextval(''pms_change_seq'') WHERE change_seq IS NULL;', t);
  END LOOP;
END $$;
```

### 4.2 `012_soft_delete.sql` — 소프트 삭제 (D3)

```sql
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
```

- **삭제 동작 변경:** 물리 `DELETE` → `UPDATE ... SET deleted_yn='Y', deleted_at=now(), modify_date=now()`. 트리거가 `change_seq`를 재부여 → 델타에 자연 편승.
- **읽기 규칙:** 전 조회 경로에 `deleted_yn='N'` 필터 추가(§6에 전략).
- **소유권 준수:** 삭제도 소유자만. 마스터는 중앙만, 실적은 엣지만 삭제.

### 4.3 `013_sync_state.sql` — 엣지 커서 (§3.2 DDL, 위 참조)

### 4.4 `014_sync_node.sql` — 중앙 노드 레지스트리 (D2)

```sql
CREATE TABLE IF NOT EXISTS sync_node (
  node_id       text PRIMARY KEY,          -- 예: 'edge-dsrj2-01'
  vessel_no     text NOT NULL,             -- 이 노드가 대표하는 선박
  token_hash    bytea NOT NULL,            -- 토큰 원문 저장 금지(해시)
  status        char(1) DEFAULT 'A',       -- A(active)/S(suspended)
  last_seen_at  timestamp,
  regist_date   timestamp DEFAULT now(),
  regist_user   text
);
CREATE INDEX IF NOT EXISTS ix_sync_node_vessel ON sync_node(vessel_no);
```

---

## 5. 노드 인증 게이트웨이 (D2)

> 현재 `middleware.ts` 없음 → **신규 생성.** 중앙에서만 활성(`NODE_ROLE=central`).

### 5.1 요청 규약 (엣지 → 중앙)
```
Authorization: Bearer <NODE_TOKEN>
X-Node-Id:     edge-dsrj2-01
X-Vessel-No:   DSRJ2
X-Batch-Id:    <uuid>          # upload 시
```

### 5.2 게이트웨이 로직 (`middleware.ts`)
```
matcher: ['/api/sync/:path*', '/api/data/:path*']

if NODE_ROLE != 'central':  통과(엣지 자기 자신 로컬 호출)
1. Authorization Bearer 토큰 추출 → 없으면 401
2. sha256(token) 해시 → sync_node.token_hash 조회 (status='A')
   - 불일치/미존재/정지 → 401
3. X-Vessel-No == sync_node.vessel_no 확인 → 불일치 401/403
4. (upload) 페이로드 내 모든 row.vessel_no == 노드 vessel_no 강제
   - 타 선박 데이터 주입 시도 → 403 (GAP-3/6 동시 차단)
5. sync_node.last_seen_at = now() 갱신 → 통과
```

> **주의:** Next.js middleware는 Edge 런타임. `pg` 직접 접근이 제약될 수 있어, **토큰 검증은 경량 내부 API(`/api/_internal/verify-node`, Node 런타임)로 위임**하거나, middleware는 헤더 존재/형식만 확인하고 **각 `/api/sync/*` 핸들러 진입부에서 DB 검증**하는 방식을 택한다(구현 시 §13-R3 결정).

### 5.3 토큰 수명주기
- 발급: 온보딩 시 랜덤 32바이트 → 노드에 `NODE_TOKEN`으로 주입, 중앙엔 `sha256` 해시만 저장.
- 폐기/회전: `sync_node.status='S'` 또는 재발급. 분실 노드 즉시 차단 가능.
- 전송: HTTPS 필수. (가능 시 중앙 앞단 IP allowlist 병행)

---

## 6. 소프트 삭제 읽기 반영 전략 (D3)

전 조회 경로에 `deleted_yn='N'` 필터가 필요 — 광범위하나 기계적. 3택:

| 방식 | 장점 | 단점 | 권고 |
|------|------|------|------|
| A. 각 SELECT에 `and deleted_yn='N'` 추가 | 명시적 | 누락 위험, 다수 파일 | 소규모 |
| **B. 활성 행 뷰(`v_<table>`) 생성 후 조회를 뷰로 전환** | 누락 방지, 일괄 | 뷰 전환 작업 | **권고** |
| C. RLS/파티션 | 강력 | 과설계 | 불채택 |

- 회귀 방지: "13개 테이블 조회는 반드시 `deleted_yn='N'` 경유" 단위테스트(grep 기반 린트 포함).

---

## 7. `user` 하향 동기화 = 오프라인 로그인 (D4)

- `user`를 동기화 대상(중앙 → 엣지)에 포함(§1.2). `password`(bytea) 사본 포함.
- **필터 필수: `WHERE ship_no = :VESSEL`.** 해당 선박 승선원 계정만 하향(스코프 확정 §1.2). `user`는 vessel_no가 없어 자동 스코프가 안 되므로 명시 필터 없으면 회사 전체 계정이 복제됨.
- 로그인 라우트([login](../../app/api/common/users/login/route.ts))는 이미 로컬 `"user"` 테이블을 조회 → **엣지에 user가 채워지면 코드 변경 없이 오프라인 로그인 동작.**
- 소유권: 중앙이 소유. 엣지는 읽기전용 사본(엣지에서 사용자 생성/수정 불가).
- 보안: 이중 축소 — (1) 해당 선박 승선원만, (2) HW 자체통제(Q2). 디스크 암호화는 §13-R5.
- 초기 온보딩 시 **최초 풀 동기화**로 해당 선박 승선원 계정 일괄 하향.
- ⚠️ **엣지에서 하선/전배 반영:** 승선원이 바뀌면 중앙에서 `ship_no` 변경(또는 소프트삭제)이 발생 → 그 delta가 엣지로 내려가야 이전 승선원 계정이 엣지에서 정리됨(§13-R8).

---

## 8. 회선 감지 트리거 (D5)

### 8.1 중앙 `/api/health` (신규, 경량)
```
GET /api/health  →  200 { ok: true }   (DB ping 1회, 짧은 timeout)
```

### 8.2 엣지 연결 감시자
`instrumentation.ts`의 `register()`에서 `NODE_ROLE=edge`일 때만 기동:

```
상태 = 'offline'
setInterval(15~30s):
  reachable = await headHealth(REMOTE_SITE_URL/api/health, timeout=3s)
  if reachable && 상태=='offline':      # offline→online 전이
       상태='online';  runSyncOnce()    # 즉시 동기화
  else if !reachable:
       상태='offline'

runSyncOnce():           # 중복 실행 방지 뮤텍스
  if 실행중: return
  try  upload();  download()
  catch → 지수 백오프(최대 N), 다음 감지 회차에 재시도
```

- node-cron 주기 실행은 **보조(예: 6h 안전망)**로만 유지 가능. 주경로는 회선 감지 즉시.
- "즉시"의 실질 지연 = 감지 간격(수 초~수십 초). 상시 폴링 부하 미미.

---

## 9. 엣지 배포 패키지 (D6)

### 9.1 `docker-compose.edge.yml`
```yaml
services:
  db:
    image: postgres:17      # V8: RDS 실측 17.9 → 엣지도 17 정렬(초안 15에서 정정)
    environment:
      POSTGRES_DB: toadsdocument
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASS}
    volumes: [ "pgdata:/var/lib/postgresql/data" ]
    restart: always
  web:
    image: 209967847017.dkr.ecr.ap-northeast-2.amazonaws.com/toads-pms:latest  # 중앙과 동일 이미지
    environment:
      NODE_ROLE: edge
      NODE_ENV: production
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: toadsdocument
      DB_USER: postgres
      DB_PASS: ${DB_PASS}
      DB_SSL: "false"                   # V10: 엣지 로컬 PG는 SSL 미지원
      VESSEL: ${VESSEL}                 # 예: DSRJ2
      REMOTE_SITE_URL: https://pms.toads.kr
      NODE_ID: ${NODE_ID}
      NODE_TOKEN: ${NODE_TOKEN}
      PORT: 30001
    depends_on: [ db ]
    ports: [ "30001:30001" ]
    restart: always
volumes: { pgdata: {} }
```

### 9.2 부트스트랩 절차(온보딩)
```
1. 중앙: vessel 마스터 등록 + sync_node 발급(node_id, token) → token_hash 저장
2. 엣지 HW: docker compose up (web+db)
3. 스키마 적용: 009_tsql_shim → 011 → 012 → 013 (엣지 로컬 DB)
4. **부트스트랩 풀-익스포트(V3):** 정상 download는 upload-소유 이력을 제외하므로, 온보딩은 **전용 seed 엔드포인트**로 해당 vessel의 **전 13T(방향 무시)** 를 일괄 적재 — 마스터/계획/user + **과거 정비·재고 이력(work/used_parts/receive/release/loss)** 포함. (기존 클라우드 사용 vessel의 이력 보존 필수)
5. 이후 steady-state: 회선 감지 시 §3.3 델타 동기화로 전환
6. 선내 LAN 접속 확인: http://<edge-ip>:30001  (또는 ship-pms.local)
7. 헬스체크 후 운영 개시
```

### 9.3 접속
- 승조원: 선내 LAN에서 `http://<고정사설IP>:30001`. 인터넷 불요.
- 위성/LTE 라우터는 엣지의 **outbound 동기화용**으로만(선택적).

---

## 10. DB 연결 강건화 (GAP-7)

[db/index.ts](../../db/index.ts) `getPool()` 보강:
```
new Pool({
  ...,
  connectionTimeoutMillis: 3000,   // 연결 3s 초과 즉시 실패(선상 무한대기 방지)
  idleTimeoutMillis: 30000,
  max: 10,
  keepAlive: true,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
})
// 세션 statement_timeout(예: 15s)로 장기 쿼리 차단
```
> **V10(엣지 SSL):** RDS는 SSL 강제지만 **엣지 로컬 Postgres·로컬 개발 DB는 SSL 미지원** → 기존 `ssl` 하드코딩은 엣지 연결 실패를 유발. `DB_SSL=false`로 비활성 가능하게 함(기본은 SSL 유지=RDS 무영향). 엣지 compose에 `DB_SSL=false` 필요. 2026-07-01 로컬 PG17 연결 검증에서 확인.

---

## 11. API 명세 (신규/변경)

| 메서드·경로 | 역할 | 인증 | 비고 |
|-------------|------|------|------|
| `POST /api/sync/upload` | 중앙: 엣지 변경분 수신(13T, 소유권 검증, 멱등 MERGE) | 노드 토큰 | 기존 `data/*/set` 통합·대체 |
| `POST /api/sync/download` | 중앙: vessel별 change_seq 델타 반환 | 노드 토큰 | 기존 `data/all/get` 대체 |
| `GET /api/health` | 중앙: 헬스(DB ping) | 없음 | 감시자용 |
| `GET /api/scheduler/run` | 엣지: upload+download 1회 실행(감시자/보조cron 호출) | 로컬 | 기존 send/receive 통합 |

> 기존 `scheduler/send`·`receive`, `data/*`는 **커서 기반·전 테이블·삭제 반영**으로 리팩터하거나 위 신규 엔드포인트로 대체. 하위호환 불필요(내부 채널).

### 11.1 upload 요청/응답 예
```jsonc
// 요청 (업로드 대상 = upload-only + 양방향 마스터, V1)
{ "cursor": 10420, "batch_id": "…uuid…",
  "rows": { "maintenance_work":[…], "used_parts":[…], "release":[…], "loss":[…], "receive":[…],
            "equipment":[…], "section":[…], "material":[…], "warehouse":[…] } }
// 응답
{ "success": true, "ack_seq": 10731 }
```

---

## 12. 파일 변경 지도 (구현 매핑)

| 작업 | 대상 | 단계 |
|------|------|------|
| pool/statement 타임아웃 | `db/index.ts` | P0 |
| 인증 게이트웨이 | `middleware.ts`(신규) + `/api/sync/*` 핸들러 검증 | P0 |
| 마이그레이션 011~014 | `migration/sql/011_…~014_…sql` | P0/P1 |
| upload/download 엔드포인트 | `app/api/sync/upload/route.ts`, `download/route.ts`(신규) | P1 |
| 13T 커버리지·멱등 **ON CONFLICT**(MERGE 금지·F1)·소유권 필드·`set_config` 에코차단 | 위 핸들러 + 기존 `data/*` 폐기 | P1 |
| 양방향 마스터 충돌 가드(`WHERE EXCLUDED.modify_date >= …`) | sync 핸들러 upsert(§3.5) | P1 |
| (R9=a) 마스터 **생성은 중앙 단독** — 엣지에서 `/insert` **및 `/save`의 생성분기(WHEN NOT MATCHED)** 차단(V4), 수정만 허용 | `ship/equipment·section·inventory/material·warehouse/{insert,save}` | P1 |
| **부트스트랩 seed 엔드포인트**(전 13T 풀-익스포트, 방향무시·V3) | `app/api/sync/seed/route.ts`(신규) | P2 |
| 물리삭제 → 소프트삭제 전환(V5) | `ship/inventory/warehouse/delete` 등 delete 라우트 | P1.5 |
| 엣지 NTP 강제(충돌 tiebreak 신뢰성) | 엣지 OS/compose | P2 |
| `user` 하향 포함 | download 델타 집합 | P1 |
| 회선 감지 감시자 | `instrumentation.ts` + `lib/sync/watcher.ts`(신규) | P1 |
| `/api/health` | `app/api/health/route.ts`(신규) | P1 |
| 소프트삭제 쓰기 전환 + 읽기 뷰/필터 | 삭제 라우트 + 조회 경로(뷰 전환 권고) | P1.5 |
| `NODE_ROLE` 분기(엣지 UI/기능 제한) | 레이아웃·라우팅 | P2 |
| 엣지 패키지·부트스트랩 | `docker-compose.edge.yml`, `scripts/edge-bootstrap.*`(신규) | P2 |
| 노드 등록/토큰 관리 + 동기화 대시보드 | admin 화면·API(신규) | P3 |

### 12.1 재사용 자산
`adaptNamedParams`, `query/execute/withTransaction`, 멀티배포(`APP_ENV`) 파이프라인 — 그대로 활용.
⚠️ **MERGE UPSERT 관용구는 재사용 금지**(PostgreSQL 500·F1) → `INSERT … ON CONFLICT`로 신규 작성.

---

## 13. 결정 로그 (2026-07-01 전건 확정) + 잔여

| ID | 항목 | **확정** |
|----|------|----------|
| R1 | 초기 백필 change_seq 순서 | 테이블 무순(정합 무영향) |
| R2 | `data/*` 기존 엔드포인트 | **신규 `/api/sync/*`로 대체 후 제거** (MERGE 500이라 리팩터 무의미·F1) |
| R3 | 토큰 검증 위치 | **핸들러(Node런타임)** — pg 접근 용이. middleware는 헤더 형식만 |
| R4 | 소프트삭제 읽기 반영 | **활성행 뷰 `v_*`** |
| R6 | `used_parts`·`release`·`loss` 다운로드 | upload 전용 유지 |
| R7 | 마스터 4종 방향 | **②양방향**. 선박 입력라우트 유지, 충돌=`modify_date` LWW(§3.5) |
| **R9** | 동시 생성 ID 충돌 | **(a) 생성=중앙 단독, 수정=양방향.** 양방향 테이블마다 생성자 단일(마스터=중앙, extension=선박) → 채번 충돌 원천 불가 |
| R8 | 승선원 전배 시 엣지 정리 | **교대/온보딩 시점 재풀동기화**(delta로는 잔존 → 스냅샷 재적재) |
| R5 | 엣지 디스크 암호화·백업 | 보류(Q7) — P2 엣지 패키징 시 확정 |

> **잔여 보류: R5(엣지 물리보안/백업)만 P2로 이월.** 나머지 구현 착수에 필요한 결정은 전건 확정됨.

---

## 14. 검증 계획

- **오프라인 무손실:** 회선차단 상태 다건 CRUD → 복구 → change_seq 델타로 정확히 1회 반영(멱등 재전송 포함).
- **삭제 전파:** 엣지 삭제 → 중앙 `deleted_yn='Y'` 반영, 조회에서 소거. 역방향(마스터) 동일.
- **커버리지 회귀:** upload 대상 == 중앙 수신 반영 집합(13T) 단위테스트.
- **인증:** 무토큰/타 vessel 토큰/타 vessel row 주입 → 각각 401/403.
- **오프라인 로그인:** 회선차단 상태에서 하향된 user로 로그인 성공.
- **시계 왜곡 내성:** 엣지 시계 임의 변경해도 change_seq 델타 정상.
- **부하:** 20~30 노드 동시 동기화 시 중앙 RDS 풀·락 경합.

---

## 15. 다음 단계
1. ✅ **§13 결정 전건 확정 완료**(R5만 P2 이월) — 구현 착수 준비 완료.
2. `/sc:implement` — **P0(DB 타임아웃 · 노드 토큰 게이트웨이 · 마이그레이션 011~014)** 부터 착수.
3. 이후 P1(동기화 `/api/sync/*`·감시자·`/api/health`·`user` 하향·마스터 생성 중앙단독) → P1.5(소프트삭제) → P2(엣지 패키지·NTP) → P3(노드 등록·대시보드) 순.

### 15.1 구현 착수 체크리스트 (P0)
- [ ] `db/index.ts` 풀 타임아웃(`connectionTimeoutMillis`/`idleTimeoutMillis`) + `statement_timeout`
- [ ] `migration/sql/011_sync_change_seq.sql` (시퀀스·트리거·백필, `app.sync_apply` 억제 포함)
- [ ] `012_soft_delete.sql` (`deleted_yn`/`deleted_at`)
- [ ] `013_sync_state.sql` (엣지 커서)
- [ ] `014_sync_node.sql` (중앙 노드 레지스트리)
- [ ] `/api/sync/*` 핸들러 토큰 검증(R3) + `X-Vessel-No`/row vessel 일치 강제

---

> 본 문서는 설계 명세다. 실제 코드 생성은 승인 후 `/sc:implement` 단계 산출물이다.
