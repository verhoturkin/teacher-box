# syntax=docker/dockerfile:1.7
#
# Teacher Box images (ADR-0004, ADR-0031: only the split variant). Build context: repository root;
# compose.build.yaml builds them locally, CI publishes them to GHCR (ADR-0032).
#
#   target "backend"  - Spring Boot API             (ghcr.io/verhoturkin/teacher-box-backend)
#   target "frontend" - nginx with the Angular SPA  (ghcr.io/verhoturkin/teacher-box-frontend)
#
# Tests are not run here: they run in scripts/verify.sh (pre-commit hook and CI).
#
# Multi-platform (ADR-0032): the jar and the SPA do not depend on the architecture, so the build stages run on the
# builder's platform ($BUILDPLATFORM) once, and only the runtime stages are built per target platform.

ARG NODE_IMAGE=node:24-alpine
ARG MAVEN_IMAGE=maven:3.9-eclipse-temurin-25-alpine
ARG JRE_IMAGE=eclipse-temurin:25-jre-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30-alpine
# Image version for the labels (CI passes the release tag).
ARG VERSION=dev

# ---------- frontend build ----------
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS frontend-build
WORKDIR /workspace
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- backend build ----------
FROM --platform=$BUILDPLATFORM ${MAVEN_IMAGE} AS backend-deps
WORKDIR /workspace
COPY backend/pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline

FROM backend-deps AS backend-build
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q package -DskipTests -Djacoco.skip=true \
    && java -Djarmode=tools -jar target/teacher-box.jar extract --layers --destination target/extracted

# ---------- runtime images ----------
FROM ${JRE_IMAGE} AS jre-base
RUN addgroup -S -g 10001 teacherbox \
    && adduser -S -D -H -u 10001 -G teacherbox teacherbox \
    && mkdir -p /data \
    && chown teacherbox:teacherbox /data
WORKDIR /app
ENV TEACHERBOX_DATA_DIR=/data \
    TEACHERBOX_BACKUP_RESTART=true \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/actuator/health || exit 1
USER teacherbox
ENTRYPOINT ["java", "-jar", "/app/teacher-box.jar"]

FROM jre-base AS backend
COPY --from=backend-build /workspace/target/extracted/dependencies/ ./
COPY --from=backend-build /workspace/target/extracted/spring-boot-loader/ ./
COPY --from=backend-build /workspace/target/extracted/snapshot-dependencies/ ./
COPY --from=backend-build /workspace/target/extracted/application/ ./
ARG VERSION
LABEL org.opencontainers.image.title="Teacher Box backend" \
      org.opencontainers.image.description="API and data of Teacher Box, a self-hosted portal for a tutor" \
      org.opencontainers.image.source="https://github.com/verhoturkin/teacher-box" \
      org.opencontainers.image.version="${VERSION}"

FROM ${NGINX_IMAGE} AS frontend
# Both are substituted into the nginx template at start; an unset one would leave "${...}" in the config.
ENV BACKEND_URL=http://backend:8080 \
    LIVEKIT_URL=http://livekit:7880
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=frontend-build /workspace/dist/teacher-box/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
ARG VERSION
LABEL org.opencontainers.image.title="Teacher Box frontend" \
      org.opencontainers.image.description="Web interface of Teacher Box and nginx in front of its API" \
      org.opencontainers.image.source="https://github.com/verhoturkin/teacher-box" \
      org.opencontainers.image.version="${VERSION}"
