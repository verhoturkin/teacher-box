# ADR-0031. Только вариант split

- Статус: принято
- Дата: 2026-10-06
- Заменяет: [ADR-0004](0004-delivery-variants.md) в части «Вариант 2 — single»
- Действующие правила: README («Установка», «Обновление»), [docs/operations.md](../operations.md)

## Контекст

С 1.0 портал поставлялся в двух вариантах: split (nginx + backend) и single (backend сам отдаёт SPA). Со
встроенными звонками (ADR-0030) single потерял главное преимущество — простоту: сигнализацию LiveKit
(`/livekit/`) должен проксировать nginx, которого в single нет, и пользователю приходилось дописывать правило в
свой обратный прокси и держать отдельный порт `TEACHERBOX_LIVEKIT_HTTP_PORT`. Два варианта — это два образа в
CI, вторая сборка backend с Maven-профилем `bundle-frontend`, код раздачи SPA в `platform/web` с тестами и
вдвое больше инструкций. Выигрыш single по ресурсам — около 128 МБ памяти nginx.

## Решение

- Остаётся один вариант — `compose.split.yaml`: `frontend` (nginx: SPA, `/api/`, `/livekit/`) и `backend`.
- Удалены `compose.single.yaml`, targets `single` / `single-build` в `docker/Dockerfile`, профиль
  `bundle-frontend` в `backend/pom.xml`, `SpaWebConfigurer` и `SpaResourceResolver` в `platform/web`, настройка
  `TEACHERBOX_LIVEKIT_HTTP_PORT`. Backend статику не отдаёт (`spring.web.resources.add-mappings: false`).
- E2E идут на варианте split (`compose.split.yaml` + `e2e/compose.e2e.yaml`); отдельный прокси для тестов не
  нужен — `/livekit/` проксирует nginx фронтенда.
- Образ `frontend` задаёт `BACKEND_URL` и `LIVEKIT_URL` по умолчанию, поэтому конфигурация nginx валидна и без
  `LIVEKIT_URL`; `scripts/verify.sh` и CI проверяют её `nginx -t`.

## Последствия

- Переход с single: проект Compose и том те же (`teacher-box`, `teacherbox-data`), поэтому достаточно
  `docker compose -f compose.split.yaml up -d --build --remove-orphans` — старый контейнер `app` удаляется,
  данные остаются. Правило `/livekit/` в своём прокси больше не нужно.
- Портал — минимум два контейнера; на NAS и маленьких серверах это ~128 МБ памяти на nginx.
- Одна сборка образов в CI и в `scripts/verify.sh`, меньше кода и документации.
