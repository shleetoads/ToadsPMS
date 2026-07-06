# 중앙(AWS) 재배포 계획 — 선상 엣지 동기화 기능

> 작성일: 2026-07-01
> 대상: `pms.toads.kr`(toads) · `ycpms.toads.kr`(youngchang) — ECS Fargate
> 상위 문서: [SHIP_EDGE_SYNC_DESIGN_2026-07-01.md](SHIP_EDGE_SYNC_DESIGN_2026-07-01.md)
> 배포 메커니즘: [BUILD_AND_DEPLOY.md](BUILD_AND_DEPLOY.md) 플레이북 준수
> 상태: **계획 초안** — Phase 0 코드 완결 후 실행

---

## 1. 이 배포가 여는 것 (Why)

현재 로컬 엣지에서 되는 건 **중앙의 기존(구버전) 엔드포인트에 맞춘 것**뿐이라 한계가 있다. 이 재배포 하나가 **세 가지를 동시에** 푼다:

| 잠긴 기능 | 중앙에 필요한 것 |
|-----------|------------------|
| **신규 선박 온보딩(전체 시드)** | 중앙이 vessel별 **전체 데이터(user·이력 포함)** 를 HTTP로 반환 |
| **업로드(선박→중앙)** | 중앙 수신부가 MSSQL MERGE(500) 아닌 **ON CONFLICT** 로 동작 |
| **정식 change_seq 양방향 동기화** | 중앙에 `/api/sync/*` + `change_seq`/`sync_node` 인프라 |

> **핵심:** 중앙 재배포는 "지금 브랜치를 그냥 올리는 것"이 아니다. **아직 안 쓴 중앙측 P1 코드(§2)를 완결한 뒤** 올려야 위 기능이 실제로 열린다.

---

## 2. 현 상태 vs 배포 전 완결 필요 (Code-complete gate)

`feature/ship-edge-sync-p0` 브랜치 현황:

| 구성요소 | 상태 | 배포 가치 |
|----------|------|-----------|
| `db/index.ts`(타임아웃·SSL 게이트) | ✅ 완료 | 즉시 유효(안정성) |
| 마이그레이션 011~014 | ✅ 작성 | **중앙 RDS 적용 필요**(§5) |
| `lib/sync/{nodeAuth,upsert,receive,watcher}` | ✅ 완료 | 재사용 |
| `scheduler/receive`(ON CONFLICT) | ✅ 완료 | 엣지용 |
| `/api/health` | ✅ 완료 | 감시자·스모크 |
| `/api/sync/upload` | ⚠️ **게이트웨이만(501)** | **업로드 apply 미구현 → 작성 필요** |
| `/api/sync/download` | ⚠️ **게이트웨이만(501)** | change_seq 델타 미구현 → 작성 필요 |
| **온보딩 seed 엔드포인트** | ❌ **없음** | **신설 필요**(user·이력 포함 full export) |

### 2.1 Phase 0에서 완결해야 할 중앙측 코드
1. **`/api/sync/seed`** (또는 `data/all/get` 확장) — vessel별 **전 13T + machine + user(ship_no 필터) + 이력** 을 full 반환(읽기 전용 SELECT). → 온보딩.
2. **`/api/sync/upload` apply** — 수신 배치를 `SET LOCAL app.sync_apply='on'` + ON CONFLICT로 반영(§3.4 설계). → 업로드.
3. **`/api/sync/download` 델타** — `WHERE vessel_no=:v AND change_seq>cursor`(+user는 ship_no), 수신행 max(change_seq) 반환. → 정식 동기화.
4. **`000_base_schema.sql`** 커밋 — 수동 PG 설치/온보딩 재현용(현재 스키마가 RDS에만 존재).

---

## 3. 이 배포의 특이점 (일반 배포와 다른 점)

| 항목 | 일반(시나리오 A) | 이번 배포 |
|------|------------------|-----------|
| 이미지 | 태그 교체만 | 신규 라우트 포함 |
| **DB** | 변경 없음 | **마이그레이션 011~014 선적용**(양 환경) |
| **env** | 변경 없음 | **`NODE_ROLE=central` 추가**(인증 게이트 활성) → **시나리오 B**(task def 새 리비전) |
| 신규 리소스 | 없음 | `sync_node` 테이블 + **노드 토큰 발급** |

→ **시나리오 B**(task def 리비전, [BUILD_AND_DEPLOY §4.2](BUILD_AND_DEPLOY.md))로 진행한다.

> **왜 `NODE_ROLE=central` 필수:** `verifyNode`는 `NODE_ROLE==='central'`일 때만 토큰 인증을 강제한다. 미설정 시 `/api/sync/*`가 **무인증**으로 열린다(GAP-3 재발). 중앙엔 반드시 설정.

---

## 4. 단계별 계획

| Phase | 목표 | 산출/작업 | 게이트 |
|-------|------|-----------|--------|
| **0. 코드 완결** | 중앙측 P1 완성 | §2.1 (seed·upload·download·base_schema) + 로컬 검증 | 로컬 스모크 통과 |
| **1. DB 마이그레이션** | 중앙 RDS 준비 | 011~014를 `toadsdocument`·`youngchangdocument`에 적용(§5) | 앱 무영향 확인 |
| **2. 빌드·푸시** | 이미지 준비 | `docker build`(×2) → ECR push(§3 플레이북) | ECR 이미지 확인 |
| **3. 배포(canary)** | toads 먼저 | task def 리비전(+`NODE_ROLE=central`) → `toads-service` 갱신 | rollout COMPLETED |
| **4. SG 재동기화·스모크** | 접속 복구·검증 | **Fargate IP → RDS SG 재등록(§6 필수)** + 스모크(§7) | health/login 200 |
| **5. youngchang 확산** | 나머지 환경 | 동일 절차를 `youngchang-service`에 | 스모크 통과 |
| **6. 노드 토큰·파일럿** | 실전 온보딩 | `sync_node` 발급 → 파일럿 1척 전체 시드 리허설 | 오프라인 로그인 성공 |

> **canary 원칙:** toads(Phase 3~4) 완전 검증 후에만 youngchang(Phase 5)로 확산. 문제 시 youngchang은 손대지 않은 상태로 유지.

---

## 5. DB 마이그레이션 (중앙 RDS) — 최중요·최고위험

### 5.1 적용 대상·순서
- **양 DB 모두**: `toadsdocument`, `youngchangdocument`
- 순서: (이미 적용된 `009_tsql_shim` 확인) → `011_sync_change_seq` → `012_soft_delete` → `013_sync_state`(선택, 중앙엔 커서 불필요) → `014_sync_node`

### 5.2 리스크: `change_seq` 트리거가 운영 hot-path에 부착됨
`011`은 13개 테이블에 `BEFORE INSERT OR UPDATE` 트리거를 단다. **운영 중 모든 쓰기가 이 트리거를 타게 된다.**
- 성격은 가법적(컬럼 값 1개 세팅)이라 기존 INSERT/UPDATE 결과 불변.
- 그러나 **새 실패면**이자 미세 오버헤드. 백필 UPDATE는 전 행 1회 갱신(짧은 락).
- **완화**: 저트래픽 시간대 적용 + 적용 직후 로그인/정비저장 등 핵심 라우트 스모크.

### 5.3 적용 방법(현재 접근 경로)
- 이 PC 공인 IP가 RDS SG에 등록돼 있어 `psql`로 직접 적용 가능(로컬 검증 때와 동일).
- 또는 배포 컨테이너/승인된 호스트에서 적용.
- **주의**: `013_sync_state`는 엣지용이므로 중앙엔 생략 가능. `014_sync_node`는 중앙 전용(필수).

### 5.4 순서 규칙
**마이그레이션(Phase 1)은 앱 배포(Phase 3)보다 먼저.** 신 앱의 `/api/sync/*`는 `sync_node`·`change_seq`에 의존. 단, 신 라우트는 구 앱엔 없으므로 마이그레이션을 먼저 적용해도 구 앱은 무영향(가법적).

---

## 6. 배포 메커니즘 (요약 — 상세는 플레이북)

빌드·푸시·ECS 갱신은 [BUILD_AND_DEPLOY.md](BUILD_AND_DEPLOY.md) §2~§4 그대로. 이번 배포 특화 포인트만:

1. **task def 리비전에 env 추가**: `NODE_ROLE=central` (§4.2 patch_td 흐름 활용, 또는 콘솔에서 env 추가).
2. **Fargate IP → RDS SG 재등록 (§6, 필수)**: Task 재기동으로 public IP가 바뀌므로 배포 직후 새 IP를 SG에 등록·구 IP 삭제. **이거 빠지면 로그인 500.**
3. 양 환경 각각 반복(canary 후).

---

## 7. 배포 후 검증 (스모크)

```bash
# (1) 헬스 (신규)
curl -s https://pms.toads.kr/api/health            # 기대 {"ok":true}

# (2) 로그인 회귀 (기존 동작 유지)
curl -s -X POST https://pms.toads.kr/api/common/users/login \
  -H 'Content-Type: application/json' -d '{"email":"admin","password":"..."}'  # 200

# (3) 동기화 게이트웨이 인증 (신규)
curl -s -X POST https://pms.toads.kr/api/sync/upload -d '{}'   # 무토큰 → 401
curl -s -X POST https://pms.toads.kr/api/sync/upload \
  -H 'Authorization: Bearer <NODE_TOKEN>' -H 'X-Vessel-No: DSRJ2' -d '{"rows":{}}'  # 유효 → 200/처리

# (4) 온보딩 seed (신규) — vessel 전체 반환 확인
curl -s -X POST https://pms.toads.kr/api/sync/seed -H 'Authorization: Bearer <TOKEN>' \
  -d '{"vessel_no":"DSRJ2"}' | jq '{u:(.users|length), w:(.works|length)}'  # user·이력 포함 확인
```

- **엣지 왕복 검증(Phase 6)**: 파일럿 엣지에서 `runSeed(DSRJ2)` → 로컬에 user·이력 적재 → **오프라인 로그인 성공** → 정비 저장 → **업로드가 중앙에 반영**.

---

## 8. 리스크 & 롤백

| 리스크 | 완화 |
|--------|------|
| `change_seq` 트리거가 운영 쓰기에 영향 | 저트래픽 적용 + 핵심 라우트 스모크 + 롤백 시 트리거 DROP |
| `NODE_ROLE` 미설정 → sync 무인증 노출 | task def env 검증을 배포 게이트에 포함 |
| Fargate IP SG 재등록 누락 → 로그인 500 | Phase 4 체크리스트 필수 항목, §6 자동화 스크립트 |
| 구 MERGE 라우트 여전히 500(선존 이슈) | **이번 범위 아님** — 신 `/api/sync/*`는 ON CONFLICT라 무관. 별도 트랙 |
| youngchang 동반 장애 | canary(toads 선행), youngchang은 검증 후 |

### 8.1 롤백
- **앱**: 직전 task def 리비전으로 `update-service` (수 분).
- **DB**: 마이그레이션은 가법적이라 원칙적으로 유지 가능. 문제 시 트리거·컬럼 DROP(011/012 하단 롤백 SQL 참조). `sync_node`는 미사용 시 무해.

---

## 9. 결정 필요 항목

| ID | 항목 | 옵션 | 권고 |
|----|------|------|------|
| D-1 | seed를 신규 `/api/sync/seed` vs `data/all/get` 확장 | 신규 엔드포인트 vs 기존 확장 | **신규**(범위 명확·인증 적용) |
| D-2 | 구 `data/all/get`(무인증) 존치 여부 | 유지 vs 폐기 | 신 sync 안정화까지 **유지 후 폐기** |
| D-3 | 마이그레이션 적용 주체·시간대 | 이 PC psql vs 배포호스트 / 시간대 | 저트래픽 + 승인된 경로 |
| D-4 | 노드 토큰 발급·보관 절차 | 수동 vs 관리 UI | 초기 **수동 스크립트**, 이후 UI |
| D-5 | youngchang 동시 vs 후행 | canary | **후행(canary)** |

---

## 10. 다음 행동 (제안 순서)
1. **Phase 0 착수** — `/api/sync/seed`·`upload` apply·`download` 델타 + `000_base_schema.sql` 작성, 로컬 검증.
2. **커밋** — `feature/ship-edge-sync-p0` 정리 커밋(현재 미커밋 다수).
3. **D-1~D-5 확정** 후 Phase 1(마이그레이션)부터 실행.

> 마이그레이션·트리거는 로컬 PG17에서 이미 실증 완료(트리거 3종 통과). 중앙 적용은 "검증된 것을 운영에 옮기는" 작업이며, 최대 주의점은 **운영 hot-path 트리거(§5.2)와 SG 재동기화(§6)** 두 가지다.
