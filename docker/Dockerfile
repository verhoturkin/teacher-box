# syntax=docker/dockerfile:1.7
#
# Teacher Box images (ADR-0004). Build context: repository root.
#
#   target "backend"  - Spring Boot API             (split variant, compose.split.yaml)
#   target "frontend" - nginx with the Angular SPA  (split variant, compose.split.yaml)
#   target "single"   - API + SPA in one container  (single variant, compose.single.yaml; default)
#
# Tests are not run here: they run in scripts/verify.sh (pre-commit hook and CI).

ARG NODE_IMAGE=node:24-alpine
ARG MAVEN_IMAGE=maven:3.9-eclipse-temurin-25-alpine
ARG JRE_IMAGE=eclipse-temurin:25-jre-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30-alpine

# ---------- frontend build ----------
FROM ${NODE_IMAGE} AS frontend-build
WORKDIR /workspace
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- backend build ----------
FROM ${MAVEN_IMAGE} AS backend-deps
WORKDIR /workspace
COPY backend/pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline

FROM backend-deps AS backend-build
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q package -DskipTests -Djacoco.skip=true \
    && java -Djarmode=tools -jar target/teacher-box.jar extract --layers --destination target/extracted

FROM backend-deps AS single-build
COPY backend/src ./src
COPY --from=frontend-build /workspace/dist/teacher-box/browser /frontend-dist
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q package -DskipTests -Djacoco.skip=true -Pbundle-frontend -Dfrontend.dist=/frontend-dist \
    && java -Djarmode=tools -jar target/teacher-box.jar extract --layers --destination target/extracted

# ---------- runtime images ----------
FROM ${JRE_IMAGE} AS jre-base
RUN addgroup -S -g 10001 teacherbox \
    && adduser -S -D -H -u 10001 -G teacherbox teacherbox \
    && mkdir -p /data \
    && chown teacherbox:teacherbox /data
WORKDIR /app
ENV TEACHERBOX_DATA_DIR=/data \
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

FROM ${NGINX_IMAGE} AS frontend
ENV BACKEND_URL=http://backend:8080
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=frontend-build /workspace/dist/teacher-box/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

FROM jre-base AS single
COPY --from=single-build /workspace/target/extracted/dependencies/ ./
COPY --from=single-build /workspace/target/extracted/spring-boot-loader/ ./
COPY --from=single-build /workspace/target/extracted/snapshot-dependencies/ ./
COPY --from=single-build /workspace/target/extracted/application/ ./
