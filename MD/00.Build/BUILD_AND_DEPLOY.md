# ToadsPMS — Build → Push → Deploy 운영 매뉴얼

> **이 문서의 목적**: 다른 세션·다른 사람이 열어서 **명령을 복사-붙여넣기만으로** 재빌드·재배포할 수 있게 한다.
> 2026-04-21 초판. 마지막 성공 배포: 2026-06-05, ECR git sha `70bbb55` (시나리오 A).

---

## §0. 한 줄 요약

```
로컬 빌드 → ECR push → ECS update-service → ALB 경유 로그인 200 확인
```

---

## §1. 전제 체크 (30초)

### §1.1 필수 도구

```bash
docker --version        # 29.x 이상
aws --version           # v2 (aws-cli/2.x). v1이 먼저 잡히면 아래 PATH 주의사항 참조
node --version          # v20.x
git --version
```

### §1.2 PATH 주의 (Windows)

AWS CLI v1이 `C:\Windows\System32\aws`에, v2가 `C:\Program Files\Amazon\AWSCLIV2\aws.exe`에 있으면 v1이 먼저 잡힐 수 있다. git bash에서 본 문서의 모든 `aws` 명령은 아래 PATH 앞에 추가한 뒤 실행:

```bash
export PATH="/c/Program Files/Amazon/AWSCLIV2:$PATH"
aws --version   # aws-cli/2.x 확인
```

### §1.3 자격증명

```bash
aws sts get-caller-identity
# 기대: { "Account": "209967847017", ... }
# 만료 시: aws login  또는  aws sso login
# botocore[crt] 에러 뜨면: pip install "botocore[crt]"
```

### §1.4 고정값 (변하지 않는 것들)

| 항목 | 값 |
|---|---|
| AWS Account ID | `209967847017` |
| Region | `ap-northeast-2` |
| ECR registry | `209967847017.dkr.ecr.ap-northeast-2.amazonaws.com` |
| ECR 리포지토리 | `toads-pms`, `youngchang-pms` (네임스페이스 없음) |
| ECS Cluster | `pms-cluster` |
| ECS Services | `toads-service`, `youngchang-service` |
| Task Def family | `toads-pms-task`, `youngchang-pms-task` |
| Container name | `toads-pms`, `youngchang-pms` |
| Container port | `3000` |
| Image size (standalone) | ~316MB |
| ALB | `pms-alb` (DNS: `pms-alb-440750368.ap-northeast-2.elb.amazonaws.com`) |
| 도메인 | `pms.toads.kr`, `ycpms.toads.kr` (둘 다 `pms-alb` 참조) |
| Target Groups | `tg-pms-toads`, `tg-pms-youngchang` (둘 다 port 3000, HC path `/`) |
| Execution Role | `ecsTaskExecutionRole` (계정 레벨 기본 이름) |
| Secrets Manager | `toadspms/toads-pms/db`, `toadspms/youngchang-pms/db` |
| RDS 엔드포인트 | `toads-postgres.ctcasnfgnpkm.ap-northeast-2.rds.amazonaws.com:5432` |
| RDS SG | `sg-02642934dc3bce9e2` |

### §1.5 변하는 값 (매 배포마다 갱신 필요)

| 항목 | 값 | 언제 바뀌나 |
|---|---|---|
| Fargate Task public IP | 최초: 52.79.100.177(toads), 54.180.161.193(yc) | **Task 재기동 시마다 변경됨** → RDS SG 재등록 필수 (§6.1) |
| Git SHA 태그 | `$(git rev-parse --short=7 HEAD)` | 매 커밋 |
| Task Def revision | 현재 `2` | `register-task-definition` 호출 시 +1 |

---

## §2. 빌드 (로컬)

### §2.1 이미지 2개 빌드

```bash
cd /e/Resources/ToadsPMS

DOCKER_BUILDKIT=1 docker build --build-arg PROJECT=toads      -t toads-pms:local .
DOCKER_BUILDKIT=1 docker build --build-arg PROJECT=youngchang -t youngchang-pms:local .
```

**기대 산출**: `toads-pms:local`(316MB), `youngchang-pms:local`(316MB). Next.js standalone + 포트 3000 + 비-root.

### §2.2 로컬 스모크 (선택, 5분)

```bash
# toads
docker rm -f tpms-smoke 2>/dev/null
docker run -d --name tpms-smoke -p 30013:3000 \
  -e DB_HOST=toads-postgres.ctcasnfgnpkm.ap-northeast-2.rds.amazonaws.com \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASS='*toads0228' \
  -e DB_NAME=toadsdocument \
  toads-pms:local
sleep 5
curl -s -X POST http://localhost:30013/api/common/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"toads0228"}' -w "\n[HTTP %{http_code}]\n"
# 기대: {"success":true,"user":{...}} [HTTP 200]
docker rm -f tpms-smoke
```

youngchang은 DB_NAME=`youngchangdocument`로 교체. admin 계정은 youngchang DB에 없을 수 있으므로 401 나면 그것도 정상(쿼리 동작 확인).

### §2.3 빌드 실패 시 자주 만나는 원인

| 증상 | 원인 | 해결 |
|---|---|---|
| `npm ci` 에서 lockfile mismatch | package.json만 바뀌고 lock 안 맞음 | `npm install --package-lock-only` 후 재빌드 |
| `PROJECT build-arg required` | `--build-arg` 빠짐 | 명령 재확인 |
| SWC Syntax Error in route.ts | 소스 자체 에러 | 해당 파일 수정 후 재시도 |

---

## §3. ECR Push

### §3.1 로그인 + 태그 + push

```bash
export PATH="/c/Program Files/Amazon/AWSCLIV2:$PATH"
ECR=209967847017.dkr.ecr.ap-northeast-2.amazonaws.com
GIT_SHA=$(git rev-parse --short=7 HEAD)

# ECR 로그인 (Docker 엔진에 인증 토큰 주입)
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin $ECR

# 태그 부여 (4개: 환경 2 × 태그 2)
docker tag toads-pms:local      $ECR/toads-pms:$GIT_SHA
docker tag toads-pms:local      $ECR/toads-pms:latest
docker tag youngchang-pms:local $ECR/youngchang-pms:$GIT_SHA
docker tag youngchang-pms:local $ECR/youngchang-pms:latest

# Push
docker push $ECR/toads-pms:$GIT_SHA
docker push $ECR/toads-pms:latest
docker push $ECR/youngchang-pms:$GIT_SHA
docker push $ECR/youngchang-pms:latest
```

### §3.2 Push 확인

```bash
aws ecr describe-images --repository-name toads-pms \
  --region ap-northeast-2 --query 'imageDetails[*].{tags:imageTags,size:imageSizeInBytes,pushed:imagePushedAt}' \
  --output table

aws ecr describe-images --repository-name youngchang-pms \
  --region ap-northeast-2 --query 'imageDetails[*].{tags:imageTags,size:imageSizeInBytes,pushed:imagePushedAt}' \
  --output table
```

---

## §4. 배포 (ECS)

### §4.1 시나리오 A — 이미지 태그만 교체 (가장 흔한 경우)

Task Definition이 `:latest` 참조 중이고 env·secrets 변경 없을 때. **단순 재배포**.

```bash
aws ecs update-service \
  --cluster pms-cluster \
  --service toads-service \
  --force-new-deployment \
  --region ap-northeast-2

aws ecs update-service \
  --cluster pms-cluster \
  --service youngchang-service \
  --force-new-deployment \
  --region ap-northeast-2
```

### §4.2 시나리오 B — env/secrets 변경 필요 (Task Def 새 리비전 등록)

env 변수를 추가하거나 Secrets Manager ARN이 바뀐 경우.

```bash
# 1) 현 리비전 백업
mkdir -p /tmp/td
aws ecs describe-task-definition --task-definition toads-pms-task \
  --region ap-northeast-2 --query 'taskDefinition' --output json > /tmp/td/toads.current.json
aws ecs describe-task-definition --task-definition youngchang-pms-task \
  --region ap-northeast-2 --query 'taskDefinition' --output json > /tmp/td/yc.current.json

# 2) Python 패치 스크립트 실행
python .claude/patch_td.py /tmp/td/toads.current.json /tmp/td/toads.next.json toads \
  arn:aws:secretsmanager:ap-northeast-2:209967847017:secret:toadspms/toads-pms/db-nhiRN7
python .claude/patch_td.py /tmp/td/yc.current.json /tmp/td/yc.next.json youngchang \
  arn:aws:secretsmanager:ap-northeast-2:209967847017:secret:toadspms/youngchang-pms/db-OGJdxZ

# 3) Windows 경로 변환 후 등록 (git bash의 /tmp를 AWS CLI v2가 해석 못함)
TOADS_NEXT=$(cygpath -w /tmp/td/toads.next.json)
YC_NEXT=$(cygpath -w /tmp/td/yc.next.json)

aws ecs register-task-definition --cli-input-json "file://$TOADS_NEXT" --region ap-northeast-2
aws ecs register-task-definition --cli-input-json "file://$YC_NEXT"    --region ap-northeast-2

# 4) 새 리비전으로 서비스 갱신
aws ecs update-service --cluster pms-cluster --service toads-service      --task-definition toads-pms-task --force-new-deployment --region ap-northeast-2
aws ecs update-service --cluster pms-cluster --service youngchang-service --task-definition youngchang-pms-task --force-new-deployment --region ap-northeast-2
```

`patch_td.py` 스크립트는 `E:/Resources/ToadsPMS/.claude/patch_td.py`에 있음 (§11 참조).

---

## §5. 배포 모니터링

### §5.1 Rolling 상태 watch

```bash
aws ecs describe-services --cluster pms-cluster \
  --services toads-service youngchang-service --region ap-northeast-2 \
  --query 'services[*].{name:serviceName,running:runningCount,deployments:deployments[*].[status,rolloutState,taskDefinition,runningCount]}'
```

**기대 전이**:
```
PRIMARY IN_PROGRESS taskDef:N (pending=1, running=0)
  → PRIMARY IN_PROGRESS taskDef:N (running=1)
  → ACTIVE DRAINING taskDef:N-1 (running=1 → 0)
  → PRIMARY COMPLETED taskDef:N (running=1)  ✅
```

약 60~90초 소요.

### §5.2 Target Group health

```bash
TG_TOADS=arn:aws:elasticloadbalancing:ap-northeast-2:209967847017:targetgroup/tg-pms-toads/3494488b557c07b6
TG_YC=arn:aws:elasticloadbalancing:ap-northeast-2:209967847017:targetgroup/tg-pms-youngchang/abd47c376d324631

aws elbv2 describe-target-health --target-group-arn $TG_TOADS --region ap-northeast-2 \
  --query 'TargetHealthDescriptions[*].{id:Target.Id,port:Target.Port,state:TargetHealth.State}'

aws elbv2 describe-target-health --target-group-arn $TG_YC --region ap-northeast-2 \
  --query 'TargetHealthDescriptions[*].{id:Target.Id,port:Target.Port,state:TargetHealth.State}'
```

`state=healthy` 기대.

---

## §6. 중요: RDS 보안그룹 — Task IP 재등록

### §6.1 이것만 안 하면 로그인 500

Fargate Task는 재기동할 때마다 **public IP가 바뀐다**. RDS SG는 IP /32로 허용하고 있어 새 IP로 바뀌면 DB 접속 실패.

```bash
# 1) 새 Task public IP 조회
TASK_ARNS=$(aws ecs list-tasks --cluster pms-cluster --region ap-northeast-2 \
  --query 'taskArns' --output text)

ENI_IDS=$(aws ecs describe-tasks --cluster pms-cluster --tasks $TASK_ARNS \
  --region ap-northeast-2 \
  --query 'tasks[*].attachments[*].details[?name==`networkInterfaceId`].value' \
  --output text | tr '\t' ' ')

echo "ENIs: $ENI_IDS"

aws ec2 describe-network-interfaces --network-interface-ids $ENI_IDS \
  --region ap-northeast-2 \
  --query 'NetworkInterfaces[*].{eni:NetworkInterfaceId,public:Association.PublicIp}' \
  --output table

# 2) RDS SG에서 기존 /32 규칙 전수 조회 → 삭제 → 신규 IP 추가
#    (반자동. 완전 자동화는 §6.2 참조)
aws ec2 describe-security-groups --group-ids sg-02642934dc3bce9e2 --region ap-northeast-2 \
  --query 'SecurityGroups[0].IpPermissions[?FromPort==`5432`].IpRanges[*].CidrIp'
```

**이후**: 변경된 public IP /32를 추가하고 구 IP는 삭제. 예시 (실제 IP로 치환):

```bash
# 신규 추가
aws ec2 authorize-security-group-ingress \
  --group-id sg-02642934dc3bce9e2 \
  --protocol tcp --port 5432 --cidr <NEW_IP>/32 \
  --region ap-northeast-2

# 구 삭제
aws ec2 revoke-security-group-ingress \
  --group-id sg-02642934dc3bce9e2 \
  --protocol tcp --port 5432 --cidr <OLD_IP>/32 \
  --region ap-northeast-2
```

### §6.2 자동화 스크립트 (권장)

매 배포 후 수동 관리가 번거로우니 `.claude/sync_rds_sg.sh`를 만들어 배포 시 자동 호출. (작성은 다음 세션에서 해도 됨 — 지금은 수동으로도 충분)

### §6.3 영구 해결책 (운영 TODO)

| 방법 | 작업 |
|---|---|
| VPC Peering | default VPC(172.31) ↔ RDS VPC(10.0) 피어링 + 라우트 + RDS SG에 Fargate SG 허용 |
| ECS를 RDS VPC로 이전 | 태스크가 RDS와 같은 VPC에 들어가면 내부 네트워크로 접근. 가장 깔끔 |

현재 상태는 **PoC·스테이징 수준**임을 인지하고 운영 승격 전 위 중 하나 반드시 적용.

---

## §7. 검증 (최종 배포 확인)

### §7.1 ALB 경유 로그인

```bash
# toads 환경
curl -s -X POST https://pms.toads.kr/api/common/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"toads0228"}' \
  -w "\n[HTTP %{http_code}] [%{time_total}s]\n"
# 기대: {"success":true,"user":{"account_no":10001,...}} [HTTP 200]

# youngchang 환경
curl -s -X POST https://ycpms.toads.kr/api/common/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<yc-admin-email>","password":"<pw>"}' \
  -w "\n[HTTP %{http_code}] [%{time_total}s]\n"
# 기대: 200 또는 401(쿼리는 동작, 계정 불일치)
```

### §7.2 장애 분기

| 증상 | 1차 체크 | 2차 조치 |
|---|---|---|
| HTTP 000 (timeout) | TG health | TG `unhealthy` → Task 로그 확인 (CloudWatch Logs 없으면 Task 재기동·ENI IP 확인) |
| HTTP 500 `Server error` + TG healthy | RDS SG | §6.1로 Fargate IP 재등록 |
| HTTP 401 `Invalid credentials` | 정상 (앱까지 도달함) | 계정/비밀번호 확인 |
| HTTP 502/503 | Task 기동 실패 | `describe-tasks`로 `stoppedReason` 확인 |
| Rolling COMPLETED인데 접속 안 됨 | ALB 리스너 규칙 | `describe-rules`로 host-header 매핑 점검 |

---

## §8. 롤백

### §8.1 이전 리비전으로 즉시 복귀

```bash
# 사용 가능한 리비전 목록 (최신순)
aws ecs list-task-definitions --family-prefix toads-pms-task --status ACTIVE \
  --sort DESC --region ap-northeast-2

# 이전 리비전으로 강제 배포
aws ecs update-service \
  --cluster pms-cluster --service toads-service \
  --task-definition toads-pms-task:<PREV_REVISION> \
  --force-new-deployment --region ap-northeast-2
```

### §8.2 이전 이미지 태그로 복귀

```bash
# :latest 태그를 이전 git sha로 재지정
ECR=209967847017.dkr.ecr.ap-northeast-2.amazonaws.com
PREV_SHA=<7자리-sha>

aws ecr batch-get-image --repository-name toads-pms \
  --image-ids imageTag=$PREV_SHA --region ap-northeast-2 \
  --query 'images[].imageManifest' --output text > /tmp/manifest.json

aws ecr put-image --repository-name toads-pms \
  --image-tag latest --image-manifest "$(cat /tmp/manifest.json)" \
  --region ap-northeast-2

# 서비스 재배포
aws ecs update-service --cluster pms-cluster --service toads-service \
  --force-new-deployment --region ap-northeast-2
```

---

## §9. 표준 배포 플레이북 (요약)

처음부터 끝까지 한 번에:

```bash
#!/usr/bin/env bash
set -euo pipefail

export PATH="/c/Program Files/Amazon/AWSCLIV2:$PATH"
ECR=209967847017.dkr.ecr.ap-northeast-2.amazonaws.com
GIT_SHA=$(git rev-parse --short=7 HEAD)
CLUSTER=pms-cluster
REGION=ap-northeast-2

cd /e/Resources/ToadsPMS

# 1. 빌드
DOCKER_BUILDKIT=1 docker build --build-arg PROJECT=toads      -t toads-pms:local .
DOCKER_BUILDKIT=1 docker build --build-arg PROJECT=youngchang -t youngchang-pms:local .

# 2. ECR 로그인 + 태그 + push
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR
for ENV in toads-pms youngchang-pms; do
  docker tag ${ENV}:local $ECR/${ENV}:$GIT_SHA
  docker tag ${ENV}:local $ECR/${ENV}:latest
  docker push $ECR/${ENV}:$GIT_SHA
  docker push $ECR/${ENV}:latest
done

# 3. ECS 재배포
aws ecs update-service --cluster $CLUSTER --service toads-service      --force-new-deployment --region $REGION >/dev/null
aws ecs update-service --cluster $CLUSTER --service youngchang-service --force-new-deployment --region $REGION >/dev/null

echo "Deploy triggered. SHA=$GIT_SHA"
echo "Monitor: aws ecs describe-services --cluster $CLUSTER --services toads-service youngchang-service --region $REGION --query 'services[*].deployments'"
echo "Wait ~90s then check RDS SG per §6.1 (new Fargate IPs)"
```

저장 위치 권장: `E:/Resources/ToadsPMS/scripts/deploy.sh`.

---

## §10. Secrets Manager 운영

### §10.1 현재 구조

| 시크릿 이름 | ARN (접미사 주의) | JSON 필드 |
|---|---|---|
| `toadspms/toads-pms/db` | `...:secret:toadspms/toads-pms/db-nhiRN7` | `username`, `password` |
| `toadspms/youngchang-pms/db` | `...:secret:toadspms/youngchang-pms/db-OGJdxZ` | `username`, `password` |

현재 두 시크릿의 **값은 동일** (`postgres` / `*toads0228`). 향후 환경별 전용 DB 사용자(`toads_app`, `yc_app`) 생성 후 각 시크릿에 다른 값 저장하는 것이 정석.

### §10.2 비밀번호 변경(수동 로테이션)

```bash
export PATH="/c/Program Files/Amazon/AWSCLIV2:$PATH"

# Windows 호환 tmp 경로
TMPWIN=$(cygpath -w "$(mktemp)")
TMPGIT=$(cygpath -u "$TMPWIN")
umask 077

# 새 JSON 작성 (비밀번호 직접 타이핑하지 말고 여기에만)
cat > "$TMPGIT" <<'JSON'
{"username":"postgres","password":"<NEW_PASSWORD>"}
JSON
chmod 600 "$TMPGIT"

# 시크릿 값 교체 (새 version 생성)
aws secretsmanager put-secret-value \
  --secret-id toadspms/toads-pms/db \
  --secret-string "file://$TMPWIN" \
  --region ap-northeast-2

rm -f "$TMPGIT"

# ECS에 변경 반영 (Task는 기동 시점에만 시크릿 읽음 → 재기동 강제)
aws ecs update-service --cluster pms-cluster --service toads-service \
  --force-new-deployment --region ap-northeast-2
```

같은 절차를 youngchang에도 반복. 실제 DB(RDS)의 `postgres` 유저 비밀번호도 같이 `ALTER ROLE postgres WITH PASSWORD '<NEW>';`로 변경하지 않으면 Task 기동 시 DB 인증 실패.

---

## §11. 참고: Task Definition 패치 스크립트

`E:/Resources/ToadsPMS/.claude/patch_td.py`에 이미 있음. 내용:

```python
"""Task Definition JSON 패치 스크립트.
Usage: python patch_td.py <input.json> <output.json> <env> <secret-arn>
env: toads | youngchang
"""
import json, sys

input_path, output_path, env, secret_arn = sys.argv[1:5]

with open(input_path, encoding="utf-8") as f:
    td = json.load(f)

db_name_map = {"toads": "toadsdocument", "youngchang": "youngchangdocument"}

td["containerDefinitions"][0]["environment"] = [
    {"name": "NODE_ENV", "value": "production"},
    {"name": "PORT", "value": "3000"},
    {"name": "APP_ENV", "value": env},
    {"name": "DB_HOST", "value": "toads-postgres.ctcasnfgnpkm.ap-northeast-2.rds.amazonaws.com"},
    {"name": "DB_PORT", "value": "5432"},
    {"name": "DB_NAME", "value": db_name_map[env]},
]

td["containerDefinitions"][0]["secrets"] = [
    {"name": "DB_USER", "valueFrom": f"{secret_arn}:username::"},
    {"name": "DB_PASS", "valueFrom": f"{secret_arn}:password::"},
]

for k in ("taskDefinitionArn", "revision", "status", "requiresAttributes",
          "compatibilities", "registeredAt", "registeredBy", "enableFaultInjection"):
    td.pop(k, None)

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(td, f, indent=2, ensure_ascii=False)

print(f"OK: {output_path}")
```

---

## §12. 기술 부채 목록 (운영 승격 전 처리)

| # | 항목 | 우선순위 |
|---|---|---|
| 1 | **RDS SG가 Fargate public IP /32 의존** → Task 재기동마다 수동 동기화 | **P0** — §6.1 자동화 스크립트 작성 또는 §6.3 영구 해결 |
| 2 | **Task Definition에 awslogs 미설정** → CloudWatch Logs 0건, 디버깅 불가 | **P0** — 다음 리비전에 `logConfiguration` 추가 |
| 3 | `ecsTaskExecutionRole`이 `SecretsManagerReadWrite` (PutSecretValue 포함) 과도권한 | P1 — 인라인 최소권한으로 교체 |
| 4 | RDS `PubliclyAccessible=true` | P1 — 내부 전용 전환 |
| 5 | AWS `root` 사용자 로그인 | P1 — IAM Identity Center 사용자/Role로 전환 |
| 6 | 잔존 MSSQL 구문 (MERGE/FORMAT/ISNULL/GETDATE/DATEADD 등) | P2 — PR-A 전역 치환. 로그인 외 라우트는 현재 500 |
| 7 | SSL `rejectUnauthorized: false` | P2 — RDS CA 번들 기반 검증 |
| 8 | 두 환경이 동일 `postgres` superuser 공유 | P2 — `toads_app`, `yc_app` 분리 |
| 9 | 이미지에 ts-node/dotenv devDep 등 불필요 | P3 — 트리쉐이킹·경량화 |

---

## §13. 변경 이력

| 일자 | 배포자 | 변경 | Git SHA | Task Def rev |
|---|---|---|---|---|
| 2026-04-21 | Opus/인간 | 초판 배포. mssql→pg 전환, standalone 이미지, Secrets Manager 도입 | `2669986` | 2 |
| 2026-04-23 | Sonnet/인간 | T-SQL 잔존 패턴 전수 제거. §7.2 활성 8파일 / MERGE alias LHS 23파일 / convert·format call-site 35+26파일 / §P2 shim DDL 작성 (`migration/sql/009_tsql_shim.sql`). **배포 전 §15 shim DDL 적용 필수.** | TBD | TBD |
| 2026-06-04 | Opus/인간 | 관리자 대시보드에 ME/G·E 운전시간 조회 패널(`EquipmentRuntime`) 통합 + 태스크 합산 `Number()` 캐스팅. 시나리오 A(이미지 태그 교체, `:latest` force-new-deployment). 로그인 검증 toads 200 / yc 401(정상). Fargate IP 불변(43.201.253.218, 3.38.198.169)으로 RDS SG 변경 없음. | `f6873bf` | 변경 없음(시나리오 A) |
| 2026-06-05 | Opus/인간 | PMS 업로드 템플릿 `LastestOperationTime`(hh:mm) 적재. `handleExcelUpload` 헤더 매핑 정정 + hh:mm→분 변환, `maintenance_plan.lastest_run_hour` 저장, HOURS 장비는 `equipment_runtime` upsert(upload_date=LastestDate). 시나리오 A. 로그인 검증 toads 200 / yc 401(정상). Task Def rev 3, Fargate IP 불변(13.209.2.233, 43.201.34.19)으로 RDS SG 변경 없음. | `70bbb55` | 변경 없음(시나리오 A) |

신규 배포할 때마다 한 행 추가하는 것을 권장.

---

## §15. T-SQL 호환 Shim DDL 배포 (필수, 최초 1회)

**2026-04-23 마이그레이션 이후 신규 의존성**: PostgreSQL 에 T-SQL 호환 함수 6종이 선반영되어 있어야 API 라우트의 `getdate/isnull/dateadd/datediff` 호출이 통과한다. 최초 1회 적용이며, 블루그린/Dump 복원 시 반드시 동반 이관.

### §15.1 적용 대상 함수
- `public.getdate()` — `GETDATE()` shim
- `public.isnull(anyelement, anyelement)` — `ISNULL(a,b)` shim
- `public.dateadd(text, integer, timestamp)` — `DATEADD(unit, n, dt)` shim (year/quarter/month/week/day/hour/minute/second + 축약형)
- `public.datediff(text, timestamp, timestamp)` — `DATEDIFF` shim (boundary-crossing 시맨틱)
- `public.convert_varchar_121(timestamp)` — 레퍼런스용 보조 (본 프로젝트 코드는 이미 call-site `to_char()` 로 치환됨)

### §15.2 배포 절차

```bash
# 1) psql 로 RDS 접속 (마스터 권한)
psql "host=<rds-endpoint> port=5432 dbname=pms user=<master> sslmode=require"

# 2) 파일 실행
\i /path/to/ToadsPMS/migration/sql/009_tsql_shim.sql

# 3) 생성 확인
\df public.getdate
\df public.isnull
\df public.dateadd
\df public.datediff
\df public.convert_varchar_121

# 4) search_path 에 public 포함 여부 확인
SHOW search_path;

# 5) 애플리케이션 role 에 실행 권한 부여 (role 이름은 환경별 상이)
GRANT EXECUTE ON FUNCTION public.getdate()                                TO toadsapp;
GRANT EXECUTE ON FUNCTION public.isnull(anyelement, anyelement)           TO toadsapp;
GRANT EXECUTE ON FUNCTION public.dateadd(text, integer, timestamp)        TO toadsapp;
GRANT EXECUTE ON FUNCTION public.datediff(text, timestamp, timestamp)     TO toadsapp;
GRANT EXECUTE ON FUNCTION public.convert_varchar_121(timestamp)           TO toadsapp;

# 6) 셀프테스트 (009_tsql_shim.sql 파일 하단 주석 블록 참고)
SELECT public.getdate(), public.isnull(null::text, 'x');
SELECT public.dateadd('month', 1, '2026-01-31'::timestamp);
SELECT public.datediff('day', '2026-04-01'::timestamp, '2026-04-23'::timestamp);
```

### §15.3 롤백

```sql
DROP FUNCTION IF EXISTS public.convert_varchar_121(timestamp);
DROP FUNCTION IF EXISTS public.datediff(text, timestamp, timestamp);
DROP FUNCTION IF EXISTS public.dateadd(text, integer, timestamp);
DROP FUNCTION IF EXISTS public.isnull(anyelement, anyelement);
DROP FUNCTION IF EXISTS public.getdate();
```

⚠ shim 이 없으면 다음 엔드포인트에서 `function X does not exist` 500 에러 발생:
- `/api/admin/dashboard/*`
- `/api/admin/calendar`, `/api/ship/calendar`
- `/api/ship/execution/*`, `/api/admin/maintenance/extension`
- 기타 날짜/NULL 보정을 쓰는 96 라우트 전반

### §15.4 스모크 테스트

shim DDL 적용 직후, 앱 재기동 후:
```bash
BASE=https://pms.toads.kr VESSEL=V001 USER_ID=10001 PASS=xxxxx \
  bash scripts/smoke_test.sh
```
- 주요 25+ 엔드포인트에 HTTP 1-request happy-path 확인.
- 500/502/503 응답이 1건이라도 나오면 실패로 간주, 해당 URL 과 상태코드 보고.
- shim DDL 미적용 시 대시보드/캘린더 계열 엔드포인트에서 일괄 500 반환.

### §15.5 `loss` 테이블 중복 데이터 점검

마이그레이션 기간 중 발견된 silent bug (§9.1 in REMAINING_AFTER_BATCH_MIGRATION.md) 후속 조치:
```bash
psql "host=<rds> dbname=pms ..."
\i migration/sql/010_loss_duplicate_check.sql
```
- STEP 1 진단 결과로 중복 규모 파악. 0 이면 종료.
- 중복 발견 시 STEP 2 백업 → STEP 3 정리 순서로 수동 실행.

### §15.6 회귀 방지 (CI / pre-commit)

마이그레이션을 **역행 커밋하는 것을 막기 위한** 스캔 스크립트:
```bash
bash scripts/check_tsql_residue.sh
```
10가지 T-SQL 잔존 패턴을 스캔, 1건이라도 발견되면 `exit 1`.
CI 파이프라인 또는 `.git/hooks/pre-commit` 에 등록 권장.

---

## §14. 빠른 참조 카드 (프린트해서 벽에 붙이기)

```
─────────────────────────────────────────────────
 EVERY DEPLOY:
  1. docker build (PROJECT=toads / youngchang)
  2. docker push  ($ECR/{env}:$SHA and :latest)
  3. aws ecs update-service --force-new-deployment
  4. [IMPORTANT] RDS SG에 새 Fargate IP 추가 (§6.1)
  5. curl https://pms.toads.kr/api/common/users/login  (200 확인)
─────────────────────────────────────────────────
 FIXED: 209967847017 / ap-northeast-2 / pms-cluster
         toads-service / youngchang-service
         tg-pms-toads / tg-pms-youngchang
         toadspms/{env}-pms/db  (Secrets)
─────────────────────────────────────────────────
 ROLLBACK: update-service --task-definition X:<PREV>
─────────────────────────────────────────────────
```

(끝 — §1~§14. 다음 세션에서 본 문서만 열어서 §9 플레이북 실행하면 1분 내 재배포 가능)
