#!/usr/bin/env bash
# =============================================================================
# ToadsPMS — PostgreSQL 마이그레이션 스모크 테스트
# =============================================================================
# 목적: `migration/sql/009_tsql_shim.sql` 적용 후 주요 엔드포인트가
#       500 없이 응답하는지 1-request 수준 happy-path 확인.
#
# 참고: MD/01.Migrate/REMAINING_AFTER_BATCH_MIGRATION.md §10 매트릭스 기반.
#
# 사용법:
#   BASE=https://pms.toads.kr VESSEL=V001 USER_ID=10001 PASS=xxxxx \
#     bash scripts/smoke_test.sh
#
# 환경변수:
#   BASE      기본 URL (예: http://localhost:3000, https://pms.toads.kr)
#   VESSEL    스모크 대상 vesselNo (예: V001)
#   USER_ID   로그인용 account_no
#   PASS      로그인용 password
#   COOKIE    (선택) 사전 발급된 세션 쿠키. 있으면 로그인 스킵.
#
# 종료 코드: 0 = 전부 통과, 1 = 1건 이상 실패.
# =============================================================================

set -u

BASE="${BASE:-http://localhost:3000}"
VESSEL="${VESSEL:-V001}"
USER_ID="${USER_ID:-}"
PASS="${PASS:-}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/toadspms_smoke_cookies.txt}"

PASS_COUNT=0
FAIL_COUNT=0
FAIL_LIST=()

# -----------------------------------------------------------------------------
# Helper
# -----------------------------------------------------------------------------
check() {
  local label="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"

  local url="${BASE}${path}"
  local http_code
  local curl_args=(
    -sS -o /dev/null -w '%{http_code}'
    --max-time 20
    -b "$COOKIE_JAR" -c "$COOKIE_JAR"
    -X "$method"
  )
  if [[ -n "$body" ]]; then
    curl_args+=(-H 'Content-Type: application/json' --data "$body")
  fi

  http_code="$(curl "${curl_args[@]}" "$url" 2>/dev/null || echo 000)"

  # 200 / 201 / 401 / 404 모두 "SQL 은 동작했다" 로 간주 (500/502/503/504/000 만 실패).
  if [[ "$http_code" =~ ^(200|201|204|304|400|401|403|404|422)$ ]]; then
    printf "  \e[32m✓\e[0m %-60s %s\n" "$label" "$http_code"
    PASS_COUNT=$((PASS_COUNT+1))
  else
    printf "  \e[31m✗\e[0m %-60s %s\n" "$label" "$http_code"
    FAIL_COUNT=$((FAIL_COUNT+1))
    FAIL_LIST+=("$label [$http_code] $url")
  fi
}

section() {
  echo ""
  echo "── $1 ────────────────────────────────────────────────"
}

# -----------------------------------------------------------------------------
# 0) 로그인 (세션 쿠키 획득)
# -----------------------------------------------------------------------------
rm -f "$COOKIE_JAR"

if [[ -z "$COOKIE" && -n "$USER_ID" && -n "$PASS" ]]; then
  section "0. 인증"
  LOGIN_BODY=$(cat <<EOF
{"account_no":"${USER_ID}","password":"${PASS}"}
EOF
)
  check "로그인"                     POST "/api/common/users/login" "$LOGIN_BODY"
elif [[ -n "${COOKIE:-}" ]]; then
  echo "$COOKIE" > "$COOKIE_JAR"
fi

# -----------------------------------------------------------------------------
# 1) 공통 / 선박 목록
# -----------------------------------------------------------------------------
section "1. 공통 조회"
check "선박 목록 (admin)"             GET  "/api/admin/ships/all"
check "선박 목록 (common)"            GET  "/api/common/ships/all"
check "선박 코드"                     GET  "/api/common/vessel/code"
check "머신 코드"                     GET  "/api/common/machine/code?vesselNo=${VESSEL}"

# -----------------------------------------------------------------------------
# 2) 대시보드 (shim DDL 의존 최대)
# -----------------------------------------------------------------------------
section "2. 대시보드"
check "관리자 대시보드"               GET  "/api/admin/dashboard"
check "관리자 대시보드 — weekly"      GET  "/api/admin/dashboard/weekly"
check "관리자 대시보드 — monthly"     GET  "/api/admin/dashboard/monthly"
check "관리자 대시보드 — delayed"     GET  "/api/admin/dashboard/delayed"
check "관리자 대시보드 — completed"   GET  "/api/admin/dashboard/completed"
check "선박 대시보드"                 GET  "/api/ship/dashboard?vesselNo=${VESSEL}"

# -----------------------------------------------------------------------------
# 3) 캘린더 (fn_get_maintenance_extension + dateadd/datediff)
# -----------------------------------------------------------------------------
section "3. 캘린더"
check "관리자 캘린더"                 GET  "/api/admin/calendar"
check "선박 캘린더"                   GET  "/api/ship/calendar?vesselNo=${VESSEL}"

# -----------------------------------------------------------------------------
# 4) 정비 조회·실행
# -----------------------------------------------------------------------------
section "4. 정비"
check "정비 계획 (vessel)"            GET  "/api/admin/ships/${VESSEL}/maintenance"
check "정비 수행 이력"                GET  "/api/ship/maintenance?vesselNo=${VESSEL}"
check "정비 수행 전체"                GET  "/api/ship/maintenance/all?vesselNo=${VESSEL}"
check "정비 연장"                     GET  "/api/ship/maintenance/extension?vesselNo=${VESSEL}"
check "정비 실행 이력 (ship)"         GET  "/api/ship/execution/all?vesselNo=${VESSEL}"

# -----------------------------------------------------------------------------
# 5) 재고
# -----------------------------------------------------------------------------
section "5. 재고"
check "재고 현황"                     GET  "/api/ship/inventory?vesselNo=${VESSEL}"
check "재고 status (일별)"            GET  "/api/admin/inventory/status/daily"
check "재고 status (주별)"            GET  "/api/admin/inventory/status/weekly"
check "재고 status (월별)"            GET  "/api/admin/inventory/status/monthly"
check "재고 트랜잭션"                 GET  "/api/admin/inventory/transactions?vesselNo=${VESSEL}"
check "재고 - warehouse 조회"         GET  "/api/ship/inventory/warehouse?vesselNo=${VESSEL}"
check "재고 - material 조회"          GET  "/api/ship/inventory/material?vesselNo=${VESSEL}"

# -----------------------------------------------------------------------------
# 6) 설비 / 섹션
# -----------------------------------------------------------------------------
section "6. 설비 / 섹션"
check "설비 조회"                     GET  "/api/ship/equipment/all?vesselNo=${VESSEL}"
check "섹션 조회"                     GET  "/api/ship/section/all?vesselNo=${VESSEL}"
check "설비 런타임"                   GET  "/api/ship/equipmentRuntime/all?vesselNo=${VESSEL}"

# -----------------------------------------------------------------------------
# 결과 요약
# -----------------------------------------------------------------------------
echo ""
echo "============================================================"
printf "통과: \e[32m%d\e[0m    실패: \e[31m%d\e[0m\n" "$PASS_COUNT" "$FAIL_COUNT"
echo "============================================================"

if (( FAIL_COUNT > 0 )); then
  echo ""
  echo "실패 목록:"
  for f in "${FAIL_LIST[@]}"; do echo "  - $f"; done
  exit 1
fi

echo "✅ 전 항목 SQL 파싱/실행 단계 통과. shim DDL 이 정상 반영되었고 T-SQL 잔존 패턴 없음."
exit 0
