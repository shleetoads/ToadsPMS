#!/usr/bin/env bash
# =============================================================================
# ToadsPMS — T-SQL 잔존 패턴 회귀 감시 스크립트 (CI/pre-commit 용)
# =============================================================================
# 목적: 2026-04-23 완료된 T-SQL → PostgreSQL 마이그레이션을 이후 누군가
#       역행 커밋하지 않도록 CI 파이프라인 또는 git pre-commit 에서 호출.
#       패턴 1건이라도 발견되면 exit 1.
#
# 사용법:
#   bash scripts/check_tsql_residue.sh
#
# 탐지 패턴:
#   - 레거시 mssql API (getSql, pool.transaction, rowsAffected, new sql.Request)
#   - §7.2 테이블 이름 대괄호  [vessel], [user], [warehouse] 등
#   - dbo.fn_* / dbo.usp_* 스키마 prefix
#   - EXEC (T-SQL)
#   - convert(varchar,…) / format(…) / year() / month() / day() / datepart()
#   - AS [alias]
#   - MERGE UPDATE SET 좌변 alias (SET a.col = …)
#   - T-SQL DELETE 단축형 (delete <table> where … 에서 FROM 누락)
# =============================================================================

set -u

FAIL=0
FOUND_SUMMARY=()

# ripgrep 우선, 없으면 grep 으로 폴백
if command -v rg >/dev/null 2>&1; then
  SEARCH() { rg -n "$@" 2>/dev/null; }
  SEARCH_I() { rg -n -i "$@" 2>/dev/null; }
  SEARCH_IM() { rg -n -i --multiline "$@" 2>/dev/null; }
else
  # grep -r (recursive) with TS-only filter via --include
  SEARCH() {
    local pat="$1"; shift
    grep -rnE --include='*.ts' "$pat" "$@" 2>/dev/null
  }
  SEARCH_I() {
    local pat="$1"; shift
    grep -rnEi --include='*.ts' "$pat" "$@" 2>/dev/null
  }
  SEARCH_IM() {
    # multiline: 간이 처리 — 한 줄 매칭만 지원 (grep -P 가 있으면 PCRE)
    local pat="$1"; shift
    if grep -P '' /dev/null >/dev/null 2>&1; then
      grep -rnPi --include='*.ts' "$pat" "$@" 2>/dev/null
    else
      grep -rnEi --include='*.ts' "$pat" "$@" 2>/dev/null
    fi
  }
fi

check() {
  local label="$1"
  local pattern="$2"
  local mode="${3:-plain}"   # plain | i | im

  local hits
  case "$mode" in
    i)  hits=$(SEARCH_I  "$pattern" app/api | grep -vE '^[^:]*:[^:]*:[[:space:]]*//' | wc -l) ;;
    im) hits=$(SEARCH_IM "$pattern" app/api | grep -vE '^[^:]*:[^:]*:[[:space:]]*//' | wc -l) ;;
    *)  hits=$(SEARCH    "$pattern" app/api | grep -vE '^[^:]*:[^:]*:[[:space:]]*//' | wc -l) ;;
  esac

  if (( hits > 0 )); then
    printf "  \e[31m✗\e[0m %-50s %d hits\n" "$label" "$hits"
    FOUND_SUMMARY+=("$label: $hits")
    FAIL=1
  else
    printf "  \e[32m✓\e[0m %-50s 0\n" "$label"
  fi
}

cd "$(dirname "$0")/.."

echo "============================================================"
echo "ToadsPMS — T-SQL 잔존 패턴 스캔"
echo "============================================================"

# 1. 레거시 mssql API (절대 금지)
check "legacy mssql API"       'getSql|pool\.transaction|\.rowsAffected|new sql\.Request|request\.input|\.recordset'

# 2. §7.2 대괄호 (테이블·컬럼 식별자)
check "table/column brackets"  '\[(vessel|user|release|machine|equipment|section|maintenance_plan|maintenance_work|maintenance_extension|warehouse|material|receive|loss|used_parts)\]'

# 3. AS [alias]
check "AS [alias]"             '\bAS\s+\[\w+\]' i

# 4. dbo 스키마 prefix
check "dbo.fn_ / dbo.usp_"     '\bdbo\.(fn_|usp_)'

# 5. EXEC (T-SQL 프로시저 실행)
check "T-SQL EXEC"             '\bEXEC\s+\w' i

# 6. convert(varchar, ...) — shim 불가
check "convert(varchar,…)"     '\bconvert\s*\(\s*varchar' i

# 7. format(...) — PG printf 와 시그니처 충돌
check "format(…)"              '\bformat\s*\('

# 8. T-SQL 날짜 함수 — year()/month()/day()/datepart()
check "year()/month()/day()"   '\b(year|month|day|datepart)\s*\(' i

# 9. MERGE UPDATE SET 좌변 alias (PG 15+ 금지)
check "merge SET alias LHS"    'when\s+matched\s+then\s+update\s+set\s+\w+\.\w+\s*=' im

# 10. T-SQL DELETE 단축형 — delete <identifier> where (FROM 누락)
#     (주의: false positive 가능성. delete from 제외하고 탐지)
DEL_HITS=$(SEARCH_I '\bdelete\s+\w+\s+where\b' app/api | grep -viE 'delete[[:space:]]+from' | grep -vE '^[^:]*:[^:]*:[[:space:]]*//' | wc -l)
if (( DEL_HITS > 0 )); then
  printf "  \e[31m✗\e[0m %-50s %d hits\n" "delete <table> without FROM" "$DEL_HITS"
  FOUND_SUMMARY+=("delete without FROM: $DEL_HITS")
  FAIL=1
else
  printf "  \e[32m✓\e[0m %-50s 0\n" "delete <table> without FROM"
fi

echo "============================================================"
if (( FAIL > 0 )); then
  echo "❌ T-SQL 잔존 패턴 발견:"
  for s in "${FOUND_SUMMARY[@]}"; do echo "   - $s"; done
  echo ""
  echo "참고: MD/01.Migrate/REMAINING_AFTER_BATCH_MIGRATION.md §7.1 변환 규칙"
  exit 1
fi
echo "✅ 잔존 패턴 없음. PostgreSQL 호환 상태 유지 중."
exit 0
