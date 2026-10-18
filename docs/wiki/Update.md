# Обновление

Если портал поставлен установщиком:

```bash
sudo teacherbox update
```

Команда скачает свежий `compose.yaml` и новые образы и перезапустит портал; данные и `.env` остаются.

При установке вручную — в каталоге с `compose.yaml`:

```bash
curl -fsSLO https://raw.githubusercontent.com/verhoturkin/teacher-box/main/compose.yaml
docker compose pull
docker compose up -d --remove-orphans
```

Первая команда берёт свежий `compose.yaml` (в новых версиях он может измениться), вторая скачивает
новые образы. Если портал собран из исходников — `git pull` и
`docker compose -f compose.yaml -f compose.build.yaml up -d --build --remove-orphans`.

Перед обновлением сделайте резервную копию («Настройки» в меню пользователя → «Резервные копии» →
«Создать копию сейчас») и скачайте её. Миграции базы применяются автоматически при старте. Что
изменилось и что проверить после обновления —
[в журнале изменений](https://github.com/verhoturkin/teacher-box/blob/main/CHANGELOG.md).
