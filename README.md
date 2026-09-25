# Teacher Box

Self-hosted портал для репетитора: ученики, учёт занятий и оплат, домашние задания,
уведомления (личный кабинет, Telegram, ВКонтакте, MAX) и ИИ-помощник.

**Один инстанс — один учитель.** Ученики входят по одноразовой ссылке-приглашению от учителя.
Все данные хранятся на вашем сервере в одном каталоге.

## Возможности

- **Ученики** — приглашения по ссылке, личный кабинет ученика, отключение и возврат доступа,
  сброс пароля.
- **Оплаты** — журнал занятий (в том числе пропуски), оплаты, баланс и долги, отчёт за месяц.
- **Домашние задания** — задания в Markdown с файлами, сдача ответов с вложениями, очередь
  проверки, оценки и возврат на доработку, напоминания о сроке.
- **Уведомления** — колокольчик в кабинете, дублирование в Telegram, ВКонтакте и MAX
  (ученик подключает мессенджер сам по одноразовому коду), сообщения учителя ученикам.
- **ИИ-помощник** (по желанию) — черновики заданий и проверок: Claude (Anthropic) или любой
  OpenAI-совместимый сервис, включая локальные модели (Ollama, LM Studio). Месячный лимит токенов.
- **Резервные копии** — каждую ночь и по кнопке, скачивание, восстановление одним файлом.

## Установка за 5 минут

Нужен компьютер, сервер или NAS с **Docker** и **Docker Compose v2** и ~1 ГБ свободной памяти.

```bash
git clone https://github.com/verhoturkin/teacher-box.git
cd teacher-box
cp .env.example .env
```

Откройте `.env` и задайте хотя бы:

```ini
TEACHERBOX_IDENTITY_TEACHER_PASSWORD=придумайте-надёжный-пароль
TEACHERBOX_PUBLIC_URL=https://school.example.com   # адрес, по которому откроют портал
TEACHERBOX_TIMEZONE=Europe/Moscow
```

Запустите (первая сборка занимает несколько минут):

```bash
docker compose -f compose.single.yaml up -d --build
```

Откройте `http://<адрес-сервера>:8080` и войдите как `teacher` с паролем из `.env`
(если пароль не задан, он сгенерирован и напечатан в журнале:
`docker compose -f compose.single.yaml logs | grep "Teacher account"`).

### Какой вариант выбрать

| Вариант | Файл | Когда |
|---|---|---|
| Один контейнер | `compose.single.yaml` | Проще всего; подходит почти всегда |
| Два контейнера (nginx + backend) | `compose.split.yaml` | Если нужен nginx перед приложением или отдельное масштабирование |

Команды одинаковые, меняется только имя файла.

### HTTPS

Портал рассчитан на работу за HTTPS. Проще всего поставить перед ним [Caddy](https://caddyserver.com)
— он сам получит сертификат:

```
school.example.com {
    reverse_proxy localhost:8080
}
```

Если прокси работает на том же сервере, откройте порт портала только для него:
`TEACHERBOX_HTTP_PORT=127.0.0.1:8080` в `.env` — тогда снаружи портал доступен лишь через HTTPS.

### NAS

На Synology/QNAP/TrueNAS с Docker используйте тот же `compose.single.yaml`: создайте проект
(«Container Manager» → «Проект» на Synology), укажите каталог с репозиторием и файл `.env`.
Данные хранятся в Docker-томе `teacherbox-data`.

## Обновление

```bash
cd teacher-box
git pull
docker compose -f compose.single.yaml up -d --build
```

Перед обновлением сделайте резервную копию («Настройки» → «Создать копию сейчас») и скачайте её.
Миграции базы применяются автоматически при старте. Список изменений — [CHANGELOG.md](CHANGELOG.md).

## Резервные копии и восстановление

Копии создаются каждую ночь в `/data/backups` (последние 7). Скачать или создать копию —
«Настройки» → «Резервные копии». Восстановление — положить архив в `/data/restore/` и
перезапустить. Подробно — [docs/operations.md](docs/operations.md).

## Мессенджеры

Уведомления всегда видны в личном кабинете. Мессенджеры подключаются по желанию: задайте токены
в `.env` и перезапустите портал. Боты получают сообщения сами (long polling) — публичный адрес
для вебхуков не нужен. Затем ученик (и вы) в разделе «Уведомления» нажимает «Подключить».

**Telegram**

1. Напишите [@BotFather](https://t.me/BotFather) команду `/newbot`, задайте имя и адрес бота.
2. Скопируйте токен в `TEACHERBOX_NOTIFICATIONS_TELEGRAM_BOT_TOKEN`.

**ВКонтакте** (сообщения от имени сообщества)

1. Создайте сообщество (можно закрытое) → «Управление» → «Сообщения»: включите.
2. «Работа с API» → «Ключи доступа»: создайте ключ с правом «Сообщения сообщества» →
   `TEACHERBOX_NOTIFICATIONS_VK_TOKEN`.
3. «Работа с API» → «Long Poll API»: включите, версия API 5.199, в «Типах событий» отметьте
   «Входящее сообщение».
4. Номер сообщества (цифры из `club123456`) → `TEACHERBOX_NOTIFICATIONS_VK_GROUP_ID`.

**MAX**

1. Создайте бота на платформе MAX для партнёров ([dev.max.ru](https://dev.max.ru)).
2. Токен бота → `TEACHERBOX_NOTIFICATIONS_MAX_TOKEN`.

Чтобы ссылки в сообщениях вели на портал, задайте `TEACHERBOX_PUBLIC_URL`.

## ИИ-помощник

По умолчанию выключен. В `.env`:

```ini
# Claude (Anthropic): ключ — на console.anthropic.com
TEACHERBOX_AI_PROVIDER=anthropic
TEACHERBOX_AI_API_KEY=sk-ant-...
# модель по умолчанию — claude-opus-5

# или OpenAI-совместимый сервис
TEACHERBOX_AI_PROVIDER=openai-compatible
TEACHERBOX_AI_BASE_URL=https://api.openai.com/v1     # OpenRouter: https://openrouter.ai/api/v1
TEACHERBOX_AI_API_KEY=sk-...
TEACHERBOX_AI_MODEL=gpt-5

# или локальная модель в Ollama (ключ не нужен)
TEACHERBOX_AI_PROVIDER=openai-compatible
TEACHERBOX_AI_BASE_URL=http://ollama:11434/v1
TEACHERBOX_AI_MODEL=qwen3:14b

TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT=2000000
```

После перезапуска появятся кнопки «Сгенерировать с ИИ» в редакторе задания и «Черновик
проверки» на странице проверки. Тексты уходят провайдеру только по вашему нажатию; ответ ИИ
всегда черновик, который вы правите сами. Расход — на странице «ИИ».

## Прокси для Telegram и ИИ

Из России Telegram Bot API недоступен, а API Anthropic, OpenAI и Gemini не обслуживают
российские адреса. Если на сервере есть прокси с VPN, направьте через него только эти
интеграции (ВКонтакте и MAX всегда работают напрямую):

```ini
TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY=socks5://host.docker.internal:1080
TEACHERBOX_AI_PROXY=socks5://host.docker.internal:1080
```

- Адрес прокси — `http://хост:порт` или `socks5://хост:порт`, без логина и пароля.
- Прокси на самом сервере виден из контейнера как `host.docker.internal`. Он должен слушать
  адрес, доступный контейнеру: адрес моста Docker (обычно `172.17.0.1`) или `0.0.0.0` с
  закрытым снаружи портом. Прокси, который слушает только `127.0.0.1`, из контейнера не виден.
- Прокси в соседнем контейнере (например, xray или sing-box) добавьте в тот же compose-проект
  и укажите имя сервиса: `socks5://vpn:1080`.
- Проверка: «Настройки» → «Интеграции» — у Telegram должно быть «Работает»; текст ошибки
  связи показан там же и в журнале.

Без прокси на сервере можно указать свой адрес Bot API в
`TEACHERBOX_NOTIFICATIONS_TELEGRAM_API_URL` — например, реверс-прокси к `api.telegram.org` на
своём зарубежном VPS (через него проходит токен бота, поэтому только на своём сервере).

## Все настройки

Все переменные с пояснениями — в [.env.example](.env.example). Эксплуатация, безопасность,
журналы и ресурсы — [docs/operations.md](docs/operations.md).

## Разработка

- Backend: Java 25, Spring Boot 4, Spring Modulith, H2 (файловый режим)
- Frontend: Angular 21 LTS, PrimeNG 21 (MIT), TypeScript (strict)
- Поставка: Docker Compose — один контейнер или два

Правила и архитектура — [AGENTS.md](AGENTS.md), решения — [docs/adr](docs/adr),
план — [docs/PLAN.md](docs/PLAN.md).

```bash
cd backend && ./mvnw spring-boot:run          # API на :8080, данные в backend/data
cd frontend && npx -y npm@11 ci && npm start  # UI на :4200 с прокси /api
./scripts/verify.sh                           # все проверки (как pre-commit и CI)
./scripts/e2e.sh                              # сценарные тесты Playwright на свежем контейнере
```
