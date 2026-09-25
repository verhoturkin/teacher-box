# ADR-0004. Два варианта поставки в Docker Compose

- Статус: принято
- Дата: 2026-09-25

## Решение

### Вариант 1 — split (`compose.split.yaml`)

- `backend` — `docker/Dockerfile`, target `backend`: multi-stage (Maven + JDK 25 → JRE 25),
  непривилегированный пользователь, volume `/data`, порт 8080 только во внутренней сети.
- `frontend` — `docker/Dockerfile`, target `frontend`: multi-stage (Node → `nginx-unprivileged`),
  отдаёт SPA, проксирует `/api/` и `/actuator/health` на `backend:8080`, публикуется наружу.
- Frontend и API на одном origin → CORS не нужен, cookie `SameSite=Strict` работает.
- Плюсы: фронт обновляется/масштабируется отдельно, nginx эффективно отдаёт статику.

### Вариант 2 — single (`compose.single.yaml`)

- Один образ — `docker/Dockerfile`, target `single` (цель по умолчанию): сборка фронта (Node) → сборка backend с Maven-профилем
  `bundle-frontend` (статика в `classpath:/static`) → JRE 25.
- Spring Boot отдаёт SPA (`platform/web/SpaWebConfigurer`): `index.html` возвращается для
  клиентских маршрутов (всё, что не `/api/**`, `/actuator/**` и не файл). Включается автоматически,
  только если в `classpath:/static` есть `index.html`.
- Плюсы: один контейнер, минимум ресурсов — удобно для NAS/Raspberry Pi.

### Общее

- Данные в named volume `teacherbox-data` → `/data` (`db/`, `files/`, `keys/`, `backups/`).
- Все настройки — через `.env` (`.env.example` в репозитории).
- Healthcheck по `/actuator/health`, `stop_grace_period: 30s` для корректного закрытия H2.
- Один `docker/Dockerfile` с несколькими targets — общие стадии сборки не дублируются;
  BuildKit собирает только стадии, нужные выбранному target.
- Сборка образов не требует локальных JDK/Node — всё внутри multi-stage. Тесты в образе
  не запускаются — они выполняются `scripts/verify.sh` (pre-commit, CI).
