#!/usr/bin/env node
// build_edge_win.mjs — Docker 불필요 Windows 선상 패키지 빌드 (의존성 없음)
//
// 사용법:
//   node scripts/build_edge_win.mjs [--skip-build] [--out <dir>]
//
// 산출물(기본): C:\resource\ToadsPMS\dist\ToadsPMS-Edge\
//   ToadsPMS.exe  node.exe  config.env  app\  app\.next\static  app\public
//   sql\100_pms_on_document_db.sql  logs\  1B_*.bat  서비스_*.bat  상태_확인.bat  수동_동기화.bat  README.txt
//
// 핵심: .next/standalone 에 복사된 개발자 .env* 는 패키지에 절대 포함하지 않는다.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');

// ---- args ----
const argv = process.argv.slice(2);
const skipBuild = argv.includes('--skip-build');
let outDir = path.join(ROOT, 'dist', 'ToadsPMS-Edge');
const outIdx = argv.indexOf('--out');
if (outIdx >= 0 && argv[outIdx + 1]) outDir = path.resolve(argv[outIdx + 1]);

const die = (msg) => { console.error('\n[빌드 중단] ' + msg); process.exit(1); };
const isEnvFile = (p) => /^\.env($|\.)/.test(path.basename(p));

function copyDir(src, dest, { skipEnv = false } = {}) {
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (s) => !(skipEnv && isEnvFile(s)),
  });
}

function writeCrlf(p, text) {
  fs.writeFileSync(p, text.replace(/\r?\n/g, '\r\n'), 'utf8');
}

function walk(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

function dirStats(dir) {
  let bytes = 0, files = 0;
  walk(dir, (f) => { bytes += fs.statSync(f).size; files++; });
  return { bytes, files };
}

const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' MB';

const CONFIG_TEMPLATE = `# ── 선박 인트라 PMS 설정 — 위 ①~④만 채우세요 (설정값 시트 참조) ──

# ① 선박 코드
VESSEL=여기에_선박코드

# ② 중앙 서버 (toads=https://pms.toads.kr / 영창=https://ycpms.toads.kr)
REMOTE_SITE_URL=https://pms.toads.kr

# ③ 노드 토큰 (본사 발급)
NODE_TOKEN=여기에_토큰

# ④ DB 비밀번호 (PostgreSQL 설치 시 정한 값)
DB_PASS=여기에_비밀번호

# 접속 포트 (그대로 두기)
PORT=30001

# ── 아래는 기본값 그대로 두면 됩니다 (document 프로그램 DB 와 공유) ──
# document 프로그램이 이미 쓰는 기존 DB 이름
DB_NAME=toadsdocument
# DB 사용자 이름
DB_USER=postgres
# DB 포트 (PostgreSQL 기본값)
DB_PORT=5432
# DB 주소 (같은 PC 이므로 그대로 두기)
DB_HOST=127.0.0.1
# 자동 동기화 주기(분)
SYNC_INTERVAL_MIN=10
`;

const README = `============================================================
 선박 인트라(로컬) PMS — Windows 설치 패키지 (Docker 불필요)
============================================================

■ 구성
  ToadsPMS.exe      앱 실행 런처 (더블클릭하면 서버가 뜹니다)
  node.exe          이 앱 전용 Node 런타임 (PC 에 설치된 Node 는 사용하지 않음)
  config.env        ★설정값 입력 (선박코드/중앙/토큰/DB비번 등)
  app\\              앱 본체 (건드리지 마세요)
  sql\\             DB 표 구조 파일
  logs\\            실행 로그 (자동 생성, pms-날짜.log)
  1B_기존DB에_PMS테이블_추가.bat   기존 document DB 에 PMS 표 추가
  서비스_등록.bat / 서비스_제거.bat  Windows 서비스로 등록/제거 (NSSM, 관리자 권한)
  상태_확인.bat / 수동_동기화.bat    상태 조회 / 즉시 동기화
  README.txt        이 파일

■ 요구사항
  - Windows 10 이상 64비트
  - 같은 PC 에 PostgreSQL (document 프로그램이 쓰는 것) 가 동작 중

■ 처음 설치
  1) 이 PC 에 PMS 표가 아직 없으면:  1B_기존DB에_PMS테이블_추가.bat 실행
     (config.env 의 DB_PASS 가 필요. document DB 가 맞는지 자동 확인)
  2) config.env 를 메모장으로 열어 ①선박코드 ②중앙서버 ③노드토큰 ④DB비번 입력
  3) ToadsPMS.exe 를 더블클릭해서 정상 동작 확인
     (브라우저에서 http://localhost:30001 — PORT 는 config.env 값)
  4) 상시 사용하려면: 서비스_등록.bat 를 "관리자 권한으로 실행"
     ※ nssm.exe 가 필요합니다. document 프로그램에서 쓰던 nssm.exe 를
       이 폴더에 복사해 두세요 (또는 PATH 에 있으면 자동 사용).

■ 업데이트 (새 버전 적용)
  1) 서비스_제거.bat (또는 서비스 중지)
  2) app\\ 폴더와 ToadsPMS.exe 를 새 것으로 교체
  3) 서비스_등록.bat (또는 서비스 시작)
     ※ config.env, node.exe 는 그대로 두면 됩니다.

■ 참고 / 주의
  - PC 에 Node 가 설치되어 있어도 이 패키지는 포함된 node.exe 만 사용합니다.
  - 1B_...bat 의 DB 비밀번호에 % 또는 " 문자가 들어 있으면 배치에서 안전하게
    처리할 수 없습니다. 그 경우 프롬프트에 직접 입력하거나 비밀번호를 바꾸세요.
    (ToadsPMS.exe 런처는 config.env 를 직접 읽으므로 이 제약이 없습니다.)
  - 문제 발생 시 logs\\pms-날짜.log 를 확인하세요.

■ 문의: 본사 IT 담당
============================================================
`;

// ---- 0) Node 런타임 점검 (node.exe 로 복사될 실행파일) ----
if (!process.version.startsWith('v24.')) die('현재 Node 버전이 v24.x 가 아닙니다: ' + process.version);
if (process.arch !== 'x64') die('현재 Node 아키텍처가 x64 가 아닙니다: ' + process.arch);

// ---- 1) next build ----
if (!skipBuild) {
  console.log('[1/8] npm run build ...');
  const r = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) die('npm run build 실패 (exit ' + r.status + ')');
} else {
  console.log('[1/8] (--skip-build) 기존 .next 사용');
}

const standalone = path.join(ROOT, '.next', 'standalone');
const staticSrc = path.join(ROOT, '.next', 'static');
const publicSrc = path.join(ROOT, 'public');
if (!fs.existsSync(path.join(standalone, 'server.js'))) die('.next/standalone/server.js 가 없습니다. 먼저 빌드하세요.');
if (!fs.existsSync(staticSrc)) die('.next/static 이 없습니다.');

// ---- 2) 출력 폴더 초기화 ----
console.log('[2/8] 출력 폴더 초기화: ' + outDir);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const appDir = path.join(outDir, 'app');

// ---- 3) 앱(standalone) 복사 — .env* 제외 ----
console.log('[3/8] app\\ (standalone, .env* 제외) 복사 ...');
copyDir(standalone, appDir, { skipEnv: true });
copyDir(staticSrc, path.join(appDir, '.next', 'static'));
if (fs.existsSync(publicSrc)) copyDir(publicSrc, path.join(appDir, 'public'));

// ---- 4) node.exe 복사 ----
console.log('[4/8] node.exe 복사 (' + process.version + ' ' + process.arch + ')');
fs.copyFileSync(process.execPath, path.join(outDir, 'node.exe'));

// ---- 5) 런처 컴파일 (csc) ----
console.log('[5/8] ToadsPMS.exe 컴파일 (csc) ...');
const csc = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
if (!fs.existsSync(csc)) die('csc.exe 를 찾을 수 없습니다: ' + csc + '\n       .NET Framework 4.x 가 필요합니다.');
const csSrc = path.join(ROOT, 'edge-package', 'launcher', 'ToadsPMS.cs');
if (!fs.existsSync(csSrc)) die('런처 소스가 없습니다: ' + csSrc);
const outExe = path.join(outDir, 'ToadsPMS.exe');
const rc = spawnSync(csc, ['/nologo', '/target:exe', '/platform:x64', '/optimize+', '/out:' + outExe, csSrc], { stdio: 'inherit' });
if (rc.status !== 0) die('csc 컴파일 실패 (exit ' + rc.status + ')');
if (!fs.existsSync(outExe)) die('ToadsPMS.exe 가 생성되지 않았습니다.');

// ---- 6) sql + bat + logs ----
console.log('[6/8] sql / bat / logs 복사 ...');
fs.mkdirSync(path.join(outDir, 'sql'), { recursive: true });
fs.copyFileSync(
  path.join(ROOT, 'edge-package', 'sql', '100_pms_on_document_db.sql'),
  path.join(outDir, 'sql', '100_pms_on_document_db.sql'));

const edge = path.join(ROOT, 'edge-package');
// 1B (기존 Docker 패키지의 것을 그대로)
const bat1b = fs.readdirSync(edge).find((n) => /^1B_.*\.bat$/.test(n));
if (!bat1b) die('1B_*.bat 를 edge-package 에서 찾지 못했습니다.');
fs.copyFileSync(path.join(edge, bat1b), path.join(outDir, bat1b));
// 서비스/도우미 bat
const winsvc = path.join(edge, 'winsvc');
for (const n of fs.readdirSync(winsvc).filter((n) => n.endsWith('.bat')))
  fs.copyFileSync(path.join(winsvc, n), path.join(outDir, n));

fs.mkdirSync(path.join(outDir, 'logs'), { recursive: true });

// ---- 7) config.env + README ----
console.log('[7/8] config.env + README.txt 작성 ...');
writeCrlf(path.join(outDir, 'config.env'), CONFIG_TEMPLATE);
writeCrlf(path.join(outDir, 'README.txt'), README);

// ---- 8) 검증(assert) ----
console.log('[8/8] 검증 ...');
let envHits = [];
walk(appDir, (f) => { if (isEnvFile(f)) envHits.push(path.relative(outDir, f)); });
if (envHits.length) die('app\\ 안에 .env 파일이 포함되었습니다: ' + envHits.join(', '));
if (!fs.existsSync(path.join(appDir, 'server.js'))) die('app\\server.js 가 없습니다.');
const st = dirStats(path.join(appDir, '.next', 'static'));
if (st.files === 0) die('app\\.next\\static 이 비어 있습니다.');

// ---- 요약 ----
const total = dirStats(outDir);
const appStats = dirStats(appDir);
console.log('\n================ 빌드 요약 ================');
console.log(' 출력 폴더   : ' + outDir);
console.log(' Node 런타임 : ' + process.version + ' (' + process.arch + ') → node.exe');
console.log(' ToadsPMS.exe: ' + mb(fs.statSync(outExe).size));
console.log(' node.exe    : ' + mb(fs.statSync(path.join(outDir, 'node.exe')).size));
console.log(' app\\        : ' + mb(appStats.bytes) + ', 파일 ' + appStats.files + '개');
console.log(' .next\\static: ' + st.files + '개 파일');
console.log(' 전체        : ' + mb(total.bytes) + ', 파일 ' + total.files + '개');
console.log(' .env 포함   : 없음 (검증 통과)');
console.log('===========================================');
console.log('완료.  config.env 를 채운 뒤  ToadsPMS.exe  더블클릭(테스트) 또는  서비스_등록.bat (상시).');
