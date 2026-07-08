============================================================
 선박 인트라(로컬) PMS — 설치 패키지
============================================================

■ 이 폴더 구성
  0_이미지_불러오기.bat   앱 이미지 등록 (최초 1회)
  1_데이터베이스_준비.bat  DB 생성 + 표 구조 (최초 1회)
  2_서버_시작.bat         서버 켜기 (평소 사용)
  3_서버_중지.bat         서버 끄기
  4_상태_확인.bat         상태/로그 보기
  config.env              ★설정값 4개 입력 (선박코드/중앙/토큰/비번)
  sql\                    DB 표 구조 파일 (건드리지 마세요)

■ 설치 순서 (자세한 설명은 "설치 가이드" 문서 참조)
  1) PostgreSQL 설치  (비밀번호 정하기, 포트 5432)
  2) Docker Desktop 설치 + 실행
  3) 0_이미지_불러오기.bat   (pms-edge.tar 를 이 폴더에 넣고 실행)
  4) 1_데이터베이스_준비.bat
  5) config.env 에 4개 값 입력
  6) 2_서버_시작.bat
  7) 브라우저에서  http://localhost:30001  접속

■ 본사(설치팀)가 준비해서 이 폴더에 함께 넣을 것
  - pms-edge.tar         앱 이미지 파일  (docker save 로 생성)
  - PostgreSQL 설치파일
  - Docker Desktop 설치파일
  - 설정값 시트          (선박코드 / 중앙서버 / 노드토큰)

  ※ pms-edge.tar 생성 방법(본사):
      docker pull 209967847017.dkr.ecr.ap-northeast-2.amazonaws.com/toads-pms:9ca1b84
      docker tag  ...toads-pms:9ca1b84  pms-edge:latest
      docker save pms-edge:latest -o pms-edge.tar

■ 문의: 본사 IT 담당
============================================================
