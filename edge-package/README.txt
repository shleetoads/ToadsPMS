============================================================
 선박 인트라(로컬) PMS — 설치 패키지
============================================================

■ 이 폴더 구성
  0_이미지_불러오기.bat          앱 이미지 등록 (최초 1회)
  1_데이터베이스_준비.bat         [경로B] 새 PC: 빈 DB + 표 구조 전체 생성
  1B_기존DB에_PMS테이블_추가.bat  [경로A] 기존 document DB 에 PMS 표만 추가
  2_서버_시작.bat               서버 켜기 (평소 사용)
  3_서버_중지.bat               서버 끄기
  4_상태_확인.bat               상태/동기화/로그 보기
  5_수동_동기화.bat             지금 즉시 1회 동기화
  config.env                    ★설정값 입력 (선박코드/중앙/토큰/비번)
  sql\                          DB 표 구조 파일 (건드리지 마세요)

■ 설치 경로 선택 (둘 중 하나)
  [경로A] 이 PC 에 이미 document 프로그램 DB(toadsdocument)가 있다
          → PMS 를 같은 DB 에 얹습니다.  1B_기존DB에_PMS테이블_추가.bat 사용.
  [경로B] 완전히 새(빈) PC 다
          → DB 부터 새로 만듭니다.      1_데이터베이스_준비.bat 사용.

■ 설치 순서
  1) PostgreSQL 준비
       - [경로A] 이미 설치되어 있음 (document 프로그램이 사용 중)
       - [경로B] PostgreSQL 설치 (비밀번호 정하기, 포트 5432)
  2) Docker Desktop 설치 + 실행
  3) 0_이미지_불러오기.bat   (pms-edge.tar 를 이 폴더에 넣고 실행)
  4) config.env 에 설정값 입력 (①선박코드 ②중앙서버 ③노드토큰 ④DB비번)
  5) DB 준비
       - [경로A] 1B_기존DB에_PMS테이블_추가.bat
       - [경로B] 1_데이터베이스_준비.bat
  6) 2_서버_시작.bat
  7) 브라우저에서  http://localhost:30001  접속
  (필요 시) 5_수동_동기화.bat 로 즉시 동기화, 4_상태_확인.bat 로 상태 확인.

■ 본사(설치팀)가 준비해서 이 폴더에 함께 넣을 것
  - pms-edge.tar         앱 이미지 파일  (docker save 로 생성 — 아래 참조)
  - PostgreSQL 설치파일   ([경로B] 새 PC 인 경우만)
  - Docker Desktop 설치파일
  - 설정값 시트          (선박코드 / 중앙서버 / 노드토큰)
  - 노드토큰 발급: 리포의  scripts/issue_node_token.mjs  로 토큰 + 중앙 INSERT 생성

  ※ pms-edge.tar 생성 방법(본사) — 현재 커밋 소스에서 직접 빌드:
      (ToadsPMS 리포 루트에서)
      docker build --build-arg PROJECT=youngchang -t pms-edge:latest .
      docker save pms-edge:latest -o edge-package\pms-edge.tar

■ 문의: 본사 IT 담당
============================================================
