# 선박 PMS 설치·동기화 가이드 (document DB가 이미 있는 선박)

> 대상: 선박에 직접 가서 설치하는 담당자
> 전제: 선박 PC에 PostgreSQL과 **document 프로그램용 DB**가 이미 있고, 그 DB에 PMS 표만 추가해서 같이 쓴다.
> 기준 코드: `feature/ship-edge-sync-p0` (동기화 엔진 개편 이후)

---

## 1. 동기화가 어떻게 도는가

document 프로그램과 같은 흐름이다. **선박이 먼저 말을 건다.**

1. 서버를 켜면 15초 뒤 1회, 이후 **10분마다** 자동 실행한다.
2. **보내기**: 선박에서 바뀐 행 중 아직 안 보낸 것만 육상으로 보낸다. 육상이 "받았다"고 답한 뒤에만 보냄 표시를 한다.
3. **받기**: 보내기가 성공했을 때만, 육상에서 바뀐 것을 받아 반영한다.
4. 인터넷이 끊겨 있으면 실패로 끝나고, 보낼 것은 그대로 남아 다음 회차에 다시 보낸다.
5. 선박 계정으로 로그인하면 화면 오른쪽 위에 **동기화** 버튼이 보인다. 누르면 즉시 2~3번을 실행한다. 버튼의 숫자는 아직 안 보낸 건수다.

| 항목 | 규칙 |
|---|---|
| 대상 표 | machine, equipment, equipment_runtime, section, maintenance_plan, maintenance_extension, warehouse, material, maintenance_work, used_parts, receive, release, loss (13개, 양방향) |
| 받기만 하는 표 | material_type, material_unit |
| vessel / user / tenant | document 프로그램 소유. PMS는 **없는 행만 추가**하고 기존 행은 건드리지 않는다 |
| 같은 행을 양쪽에서 고친 경우 | 선박이 아직 안 보낸 변경이 있으면 **선박 값이 이긴다** (행 단위) |
| 삭제 (창고, 부품) | 행을 지우지 않고 `delete_yn = 'Y'` 로 표시만 한다. 표시가 "수정"으로 동기화되어 반대편에서도 화면에서 사라진다. 대상 표: warehouse, material, receive |
| 하루 1회 | 받기를 전체 재수신으로 한 번 돌려 누락을 메운다 |

---

## 2. 출항 전에 본사에서 할 일

### 2.1 중앙 서버 배포
새 동기화 주소(`/api/sync/download` 등)가 중앙에 올라가 있어야 한다. 연동할 중앙(pms 또는 ycpms)에 이 브랜치를 배포한다.

### 2.2 노드 토큰 발급 (선박 1척당 1개)

```bash
node scripts/issue_node_token.mjs <선박코드>
# 예) node scripts/issue_node_token.mjs DSRJ2
```

출력이 세 덩어리로 나온다.

| 출력 | 어디에 쓰나 |
|---|---|
| (a) `NODE_TOKEN=…` 64자 | 선박 PC의 `config.env` ③번 칸 (로컬 테스트는 `.env`) |
| (b) `INSERT INTO sync_node …` | **중앙 DB**에서 실행 (toads=`toadsdocument`, 영창=`youngchangdocument`) |
| (c) 확인용 `SELECT` | (b) 실행 후 행이 보이는지 확인 |

- 토큰 원문은 중앙 DB에 저장되지 않는다(해시만 저장). 잃어버리면 다시 발급해서 (b)를 다시 실행하면 된다.
- 같은 선박코드로 다시 발급하면 이전 토큰은 무효가 된다.

토큰이 맞는지 확인:

```bash
curl -s -X POST https://pms.toads.kr/api/sync/download \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <토큰>" -H "X-Vessel-No: <선박코드>" \
  -d '{"vessel_no":"<선박코드>","cursor":999999999999}' -w "\n[HTTP %{http_code}]\n"
```

| 응답 | 뜻 |
|---|---|
| 200 `success:true` | 정상 |
| 401 | 토큰이 중앙에 등록 안 됨 (b를 안 돌렸거나 다른 DB에 돌림) |
| 403 | 토큰은 맞는데 선박코드가 다름 |
| 501 | 중앙에 새 버전이 아직 배포 안 됨 |

### 2.3 중앙 데이터 확인
- 중앙에 해당 선박(`vessel`)과 승선원 계정(`user.ship_no = 선박코드`)이 있어야 한다.
- 선박 DB에 계정이 이미 있으면 그 계정으로 로그인된다. 없는 계정만 첫 동기화 때 추가된다.

### 2.4 설치 패키지 만들기 (USB에 담을 것)

```bash
docker build --build-arg PROJECT=youngchang -t pms-edge:latest .
docker save pms-edge:latest -o edge-package/pms-edge.tar
```

USB에 담는다.
- `edge-package` 폴더 전체 (`pms-edge.tar` 포함)
- Docker Desktop 설치 파일
- 설정값 메모: 선박코드, 중앙 주소, 노드 토큰

> **출항 전 확인**: 선박 PC에서 Docker Desktop이 돌아가는지 미리 알아둘 것. BIOS 가상화가 꺼져 있거나 WSL2가 없으면 인터넷 없는 현장에서 설치가 막힌다.

---

## 3. 선박 현장 절차

| 순서 | 할 일 | 정상일 때 |
|---|---|---|
| 1 | Docker Desktop 설치 후 실행. 설정에서 "로그인 시 자동 시작" 켜기 | 트레이 고래 아이콘이 Running |
| 2 | `0_이미지_불러오기.bat` | `Loaded image: pms-edge:latest` |
| 3 | `config.env` 작성 (아래 표) | |
| 4 | `1B_기존DB에_PMS테이블_추가.bat` | 결과표 16줄의 첫 번째 열(존재 여부)이 모두 `t`, 마지막에 "완료" |
| 5 | `2_서버_시작.bat` | 로그에 `[watcher] started`, 이어서 `[sync] … ok=true … down=숫자` |
| 6 | 브라우저 `http://localhost:30001` → 선박 계정 로그인 | 장비·정비계획이 보임 |
| 7 | 오른쪽 위 **동기화** 버튼 | "동기화 완료 / 보냄 0건 / 받음 0건" |

`config.env`에 채울 값:

| 키 | 값 |
|---|---|
| `VESSEL` | 선박코드 |
| `REMOTE_SITE_URL` | `https://pms.toads.kr` 또는 `https://ycpms.toads.kr` |
| `NODE_TOKEN` | 2.2에서 발급한 64자 |
| `DB_PASS` | 선박 PostgreSQL 비밀번호 |
| `DB_NAME` | **document 프로그램이 쓰는 DB 이름** (document 프로그램 `.env`의 `DB_DATABASE` 값) |
| 나머지 | 그대로 둔다 |

- `1B`는 document 표를 건드리지 않고 PMS 표 15개와 함수만 추가한다. 두 번 실행해도 안전하다.
- `1_데이터베이스_준비.bat`는 **빈 PC용**이다. document DB가 있는 선박에서는 쓰지 않는다.
- 서버는 창을 닫아도 계속 돈다. PC를 재부팅하면 Docker Desktop이 뜬 뒤 자동으로 다시 켜진다.

### 3.1 현장 검증 (꼭 해볼 것)

1. 선박에서 정비 실적 1건 저장 → 동기화 버튼에 숫자가 붙는다.
2. 동기화 버튼 → "보냄 N건". 육상 화면(pms/ycpms)에서 그 실적이 보이는지 확인.
3. 육상에서 정비계획 이름 하나 수정 → 선박에서 동기화 → 바뀐 이름이 보이는지 확인.
4. 랜선을 뽑고 실적 1건 저장 → 동기화 버튼 → "중앙 서버에 연결할 수 없습니다". 랜선을 꽂고 다시 동기화 → 육상에 올라가는지 확인.

---

## 4. 상태 확인과 문제 해결

| 도구 | 용도 |
|---|---|
| `4_상태_확인.bat` | 컨테이너 상태, 동기화 상태(JSON), 최근 로그 |
| `5_수동_동기화.bat` | 브라우저 없이 즉시 동기화 |
| `http://localhost:30001/api/scheduler/sync` | `pending`(안 보낸 건수), `last`(마지막 결과), `lastUploadAt` / `lastDownloadAt` |

| 증상 | 원인과 조치 |
|---|---|
| "중앙 서버 인증에 실패했습니다" | 토큰 불일치. 2.2 확인 curl로 점검 후 `config.env` 수정, `2_서버_시작.bat` 재실행 |
| "중앙 서버에 연결할 수 없습니다" | 인터넷 끊김. 복구되면 다음 회차(10분)에 자동 재시도 |
| "PMS 테이블이 없습니다" | `1B`를 안 돌렸거나 `DB_NAME`이 다른 DB를 가리킴 |
| 로그에 DB 접속 오류 | `DB_PASS`, `DB_NAME` 확인. PostgreSQL 서비스가 켜져 있는지 확인 |
| 로그인은 되는데 데이터가 비어 있음 | 첫 동기화가 실패한 것. `4_상태_확인.bat`의 `last.message` 확인 |
| `remote download failed: HTTP 501` | 중앙이 구버전. 2.1 배포 필요 |
| 동기화 버튼이 안 보임 | 본사 계정으로 로그인했거나, 이 서버가 선박 서버가 아님 |

전체를 다시 받고 싶을 때:

```bash
curl -s -X POST "http://localhost:30001/api/scheduler/sync?trigger=manual&full=1"
```

---

## 5. 로컬에서 먼저 리허설하기 (이 PC를 선박인 척)

1. `node scripts/issue_node_token.mjs DSRJ2` 실행.
2. (a) 토큰을 프로젝트 `.env`의 `NODE_TOKEN`에 넣는다.
3. (b) SQL을 중앙 DB(`toadsdocument`)에서 실행한다.
4. `.env` 확인: `NODE_ROLE=edge`, `SYNC_WATCHER=on`, `VESSEL=DSRJ2`, `REMOTE_SITE_URL=https://pms.toads.kr`, `PORT=30001`.
5. `npm run build && npm start` (또는 `npm run dev`).
6. 콘솔에 `[sync] edge sync schema ensured`, `[sync] trigger=auto ok=true … down=숫자`가 나오면 성공.
7. `http://localhost:30001` 에 DSRJ2 선박 계정으로 로그인해 3.1 검증을 해본다.

> **주의**: 로컬에서 DSRJ2로 저장한 내용은 운영 중앙의 **실제 DSRJ2 데이터에 그대로 올라간다.** 테스트 실적은 나중에 육상에서 지워야 한다.

---

## 6. 알려진 제한

- 창고·부품 삭제는 `delete_yn` 표시로 동기화된다. 되살리려면 DB에서 해당 행의 `delete_yn` 을 `'N'` 으로 바꾸면 된다(양쪽에 동기화됨). 사용(출고·손망실) 이력이 있는 부품은 삭제할 수 없다.
- 선박 삭제(육상 `선박 관리`)는 예전처럼 행을 실제로 지우며 동기화 대상이 아니다.
- `delete_yn` 컬럼은 서버가 켜질 때 없으면 스스로 추가한다. 중앙 DB 계정에 권한이 없으면 로그에 실패가 남으므로 `migration/sql/016_soft_delete_flag.sql` 을 중앙 DB에서 직접 실행한다. **컬럼이 없는 상태로 새 버전이 돌면 재고 화면이 오류가 난다.**
- PostgreSQL 전환이 덜 된 기능이 남아 있다(육상·선박 공통, 이번 작업 범위 밖): 부품 등록·수정·엑셀 업로드, 입출고 내역 조회는 현재 오류가 난다. 장비·섹션·정비계획의 일괄 저장도 같은 옛 문법이 남아 있다.
- 충돌 판정은 행 단위다. 선박이 정비 실적을 저장하면 그 정비계획 행 전체가 올라가므로, 같은 계획을 육상에서 동시에 고쳤다면 육상 수정이 덮인다.
- 계정 비밀번호 변경은 PMS가 내려받지 않는다(document 프로그램 담당). PMS만 쓰는 선박은 `SYNC_SHARED_UPSERT=on`을 주면 계정도 덮어쓴다.
- 부품 엑셀 업로드가 쓰는 DB 함수 `fn_get_warehouse_no`가 스키마 파일에 없다. 선박에서 엑셀 업로드는 동작하지 않을 수 있다.

## 7. 검증 기록 (2026-11-05, 로컬)

육상 역할 서버(UTC)와 선박 역할 서버(KST, 이후 도커 컨테이너)를 이 PC에 따로 띄워 확인했다.

| 시나리오 | 결과 |
|---|---|
| vessel·user가 이미 있는 선박 DB에서 첫 동기화 | PMS 표만 채워짐. 기존 계정 유지, 없는 계정 추가, 타 선박 데이터 0건 |
| 선박에서 정비 실적·부품 사용·연장 신청 저장 후 동기화 | 육상과 값·시각 모두 일치 (7건) |
| 육상에서 계획 수정·연장 승인·보급 입고 추가 | 선박에 반영. 타 선박 변경은 안 내려옴 |
| 육상 서버 중단 상태에서 저장 후 동기화 | 실패 안내, 안 보낸 건수 유지. 복구 후 전부 올라가고 정비일이 되돌려지지 않음 |
| 변경 없이 반복 동기화, 전체 재수신 | 보냄 0 / 받음 0 |
| 도커 컨테이너 → 호스트 PostgreSQL(기본 접속 규칙) | 접속·동기화 정상 |
| 선박에서 창고 삭제 후 동기화 | 양쪽 모두 행은 남고 `delete_yn='Y'`, 육상 창고 목록에서 사라짐 |
| 육상에서 미사용 부품 삭제 후 동기화 | 부품과 육상 보급 입고 행이 양쪽 모두 `'Y'`, 선박 부품 목록에서 사라짐 |
| 사용 이력이 있는 부품 삭제 시도 | 거부(409), 아무것도 바뀌지 않음 |
| `delete_yn` 컬럼이 없는 육상 DB로 서버 기동 | 기동 직후 3개 표에 자동 추가 |
| 육상 미연결 상태에서 입고·손망실·창고 등록 | 정상 저장 응답(이전에는 저장 후 오류 표시) |
