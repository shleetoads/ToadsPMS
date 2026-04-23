# syntax=docker/dockerfile:1.7
# ToadsPMS — ECS Fargate 이미지 (Next.js 15 standalone + PostgreSQL)
# Build:
#   docker build --build-arg PROJECT=toads       -t toads-pms:local .
#   docker build --build-arg PROJECT=youngchang  -t youngchang-pms:local .
# 환경 구분은 ECS Task Definition의 environment (DB_HOST/DB_NAME/...) 로 주입한다.
# PROJECT build-arg는 이미지 메타데이터 용도이며 현재 빌드 산출은 공통이다.

# ─── Stage 1: builder ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ARG PROJECT
RUN test -n "$PROJECT" || (echo "ERROR: PROJECT build-arg required (toads|youngchang)" >&2 && exit 1) \
 && case "$PROJECT" in \
      toads|youngchang) : ;; \
      *) echo "ERROR: Unknown PROJECT=$PROJECT (expected: toads|youngchang)" >&2 && exit 1 ;; \
    esac

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 2: runner ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ARG PROJECT
ENV NODE_ENV=production \
    PROJECT=${PROJECT} \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# 비-root 사용자
RUN addgroup -S app && adduser -S app -G app

# Next.js standalone 산출물 + 정적 자산
COPY --from=builder --chown=app:app /app/public              ./public
COPY --from=builder --chown=app:app /app/.next/standalone    ./
COPY --from=builder --chown=app:app /app/.next/static        ./.next/static

USER app
EXPOSE 3000

# 시크릿·설정은 ECS Task Definition environment 로 주입:
#   DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME
CMD ["node", "server.js"]
