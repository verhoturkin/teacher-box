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

Перед обновлением сделайте резервную копию («Настройки» внизу панели разделов → «Данные» → «Резервные копии» →
«Создать сейчас») и скачайте её. Миграции базы применяются автоматически при старте. Что
изменилось и что проверить после обновления —
[в журнале изменений](https://github.com/verhoturkin/teacher-box/blob/main/CHANGELOG.md).

## Переменные, которые больше не читаются

Начиная с версии с «настройками в портале» то, что учитель настраивает под себя, живёт в самом
портале ([Настройки](Settings)), а не в `.env`. При **первом** запуске новой версии портал один раз
читает старые значения из `.env` и переносит их в настройки; дальше переменная не действует, и её
можно удалить. Изменённая позже переменная ничего не меняет. Пока такие строки остаются в `.env`,
администратор видит их в «Настройках» → «Перенесено в настройки учителя» (значения не показываются),
а в журнале при каждом запуске появляется предупреждение «переменная больше не читается — удалите
её из .env».

**Учитель — только в портале** (префикс `TEACHERBOX_` у переменных опущен):

| Было в `.env` | Где теперь |
|---|---|
| `TIMEZONE` | «Настройки» → «Занятия» → «Время и цена» |
| `BILLING_CURRENCY` | «Занятия» → «Время и цена» (до первой оплаты) |
| `BILLING_DEFAULT_LESSON_DURATION`, `SCHEDULE_DEFAULT_DURATION` | «Занятия» → «Время и цена» — одна длительность |
| `SCHEDULE_LATE_CANCELLATION`, `SCHEDULE_REMINDERS`, `SCHEDULE_HORIZON`, `HOMEWORK_DUE_SOON_WINDOW` | «Занятия» → «Правила» |
| `PUBLIC_URL` | адрес портала (по умолчанию `https://<домен>`) |
| `IDENTITY_TEACHER_NAME` | «Мой аккаунт» → «Профиль» (новый аккаунт называется «Учитель») |
| `NOTIFICATIONS_TELEGRAM_BOT_TOKEN`, `NOTIFICATIONS_VK_TOKEN`, `NOTIFICATIONS_VK_GROUP_ID`, `NOTIFICATIONS_MAX_TOKEN` | «Мессенджеры» |
| `SCHEDULE_GOOGLE_CLIENT_ID`, `SCHEDULE_GOOGLE_CLIENT_SECRET` | «Занятия» → «Google Календарь» |
| `BACKUP_GOOGLE_CLIENT_ID`, `BACKUP_GOOGLE_CLIENT_SECRET` | «Данные» → «Google Диск» |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_EFFORT`, `AI_FALLBACKS`, `AI_MAX_TOKENS`, `AI_TIMEOUT`, `AI_MONTHLY_TOKEN_LIMIT` | «ИИ-помощник»: первое подключение, его модель — основная |

**Администратор — в портале, сразу.** Эти переменные по-прежнему можно оставить в `.env` — тогда они
действуют, но значение, заданное в портале, важнее:

| Переменные | Раздел «Настроек» администратора |
|---|---|
| `HOMEWORK_MAX_FILE_SIZE`, `HOMEWORK_MAX_FILES_PER_UPLOAD` | «Файлы в заданиях» |
| `*_PROXY`, `NOTIFICATIONS_TELEGRAM_API_URL` | «Сеть и прокси» |
| `IDENTITY_*_TTL`, `IDENTITY_MAX_FAILED_LOGINS`, `IDENTITY_LOCK_DURATION`, `SECURITY_AUTH_RATE_LIMIT_*` | «Вход и сеансы» |
| `BACKUP_CRON`, `BACKUP_KEEP_DAYS`, `BOARDS_BACKUP_*` | «Резервные копии» |
| `NOTIFICATIONS_MAX_ATTEMPTS`, `NOTIFICATIONS_LINK_CODE_TTL`, `NOTIFICATIONS_WEBPUSH_SUBJECT` | «Сообщения» |

**Остаются только в `.env`:**

| Переменные | Почему |
|---|---|
| `DOMAIN`, `COMPOSE_PROFILES`, `HTTP_PORT`, `VERSION` | Читает Docker до запуска |
| `MEMORY_LIMIT`, `CPU_LIMIT`, `JAVA_TOOL_OPTIONS` | Лимиты контейнера |
| `LIVEKIT_*`, `MEETINGS_LIVEKIT_*` | Общие с контейнером LiveKit |
| `IDENTITY_TEACHER_LOGIN`, `IDENTITY_TEACHER_PASSWORD`, `IDENTITY_TEACHER_RESET_PASSWORD`, `IDENTITY_ADMIN_*` | Вход, когда в портал не попасть |
| `SECURITY_JWT_SECRET`, `BACKUP_RESTART`, `LOGGING_*` | Нужны до старта |

Установщик больше не записывает `TEACHERBOX_TIMEZONE`; у уже установленного портала переменную можно
удалить после первого запуска новой версии.
