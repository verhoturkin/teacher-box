# План реализации Teacher Box

Пошаговый план. Каждый подэтап завершается зелёным `./scripts/verify.sh` и коммитом
(см. AGENTS.md §8–9). Отмечайте `[x]` в том же коммите, что и код.

Легенда: **B** — backend, **F** — frontend, **D** — docker/инфраструктура.

---

## Этап 0. Основа проекта и документация

- [x] 0.1 `AGENTS.md`, `CLAUDE.md` — правила, архитектура, соглашения.
- [x] 0.2 `docs/PLAN.md` — этот план.
- [x] 0.3 ADR: 0001 модульный монолит, 0002 встраиваемая БД, 0003 аутентификация,
      0004 варианты поставки, 0005 уведомления, 0006 ИИ.
- [x] 0.4 `.gitignore`, `.gitattributes`, `.editorconfig`, README (кратко).

## Этап 1. Каркас backend

- [x] 1.1 **B** Maven-проект `backend/`: Spring Boot 4.1, Java 25, Maven Wrapper,
      зависимости (webmvc, security, oauth2-resource-server, jdbc, flyway, h2,
      validation, actuator, modulith), JaCoCo с порогами 90/80.
- [x] 1.2 **B** Пакеты-модули `shared`, `platform`, `identity`, `billing`, `homework`,
      `notifications`, `ai` с `package-info.java` (`@ApplicationModule`, `@NullMarked`).
- [x] 1.3 **B** `shared`: `Ids` (UUID v7), `Money`, `CurrentUser`/`Role`, доменные исключения
      (`NotFoundException`, `ConflictException`, `ForbiddenException`, `BusinessRuleException`),
      `FileStorage` (интерфейс), `JwtClaims`.
- [x] 1.4 **B** H2 file mode (`<data-dir>/db`), `shared/persistence/ModuleMigrations`:
      per-module Flyway (своя схема + своя history-таблица), JDBC-бины ждут миграций.
- [x] 1.5 **B** `platform/web`: `ProblemDetail`-обработчик ошибок, `platform/storage`:
      `LocalFileStorage` с namespace'ами модулей и защитой от path traversal.
- [x] 1.6 **B** Архитектурные тесты: `ModularityTests` (verify + Documenter),
      ArchUnit (domain без Spring, нет field injection, контроллеры только в `web`,
      модули не зависят от `platform`), smoke-тест контекста.
- [x] 1.7 **B** `application.yaml` (переопределение через env `TEACHERBOX_*`), actuator `health`/`info`.
- [x] 1.8 **B** `platform/security`: stateless filter chain по URL-конвенциям, HS256-ключ
      (env или файл в `/data/keys`), `JwtEncoder`/`JwtDecoder`, `PasswordEncoder`,
      резолвер `CurrentUser`, 401/403 в формате ProblemDetail.

## Этап 2. Каркас frontend

- [ ] 2.1 **F** Angular 22 workspace `frontend/` (standalone, zoneless, SCSS, routing),
      строгий `tsconfig`, `strictTemplates`.
- [ ] 2.2 **F** PrimeNG 22 + Aura, русская локаль PrimeNG и Angular (`ru`), primeicons.
- [ ] 2.3 **F** ESLint (angular-eslint + typescript-eslint type-checked): запрет `any`,
      `no-unsafe-*`, границы фич (`no-restricted-imports`).
- [ ] 2.4 **F** Vitest + coverage-пороги 90/80, `npm test` в режиме однократного прогона.
- [ ] 2.5 **F** `core/`: `AppConfig`, `ApiErrorInterceptor` (ProblemDetail → Toast),
      layout-оболочки учителя и ученика (Menubar/Sidebar), страница 404.
- [ ] 2.6 **F** `proxy.conf.json` для dev (`/api` → `localhost:8080`).

## Этап 3. Сборка и Docker

- [ ] 3.1 **D** `scripts/verify.sh` (backend/frontend/all) и `.githooks/pre-commit`
      (проверяет только затронутые части).
- [ ] 3.2 **D** `docker/backend.Dockerfile` — multi-stage (Maven → JRE 25), non-root,
      volume `/data`, healthcheck.
- [ ] 3.3 **D** `docker/frontend.Dockerfile` — multi-stage (Node → nginx-unprivileged),
      `docker/nginx.conf`: SPA fallback, прокси `/api` → backend, gzip, security headers.
- [ ] 3.4 **D** `compose.split.yaml` — вариант 1 (два контейнера, сеть, volume, healthchecks).
- [ ] 3.5 **B/D** Maven-профиль `bundle-frontend` (кладёт собранный фронт в `static/`),
      SPA-fallback контроллер в `platform/web`; `docker/single.Dockerfile`;
      `compose.single.yaml` — вариант 2 (один контейнер).
- [ ] 3.6 **D** `.env.example` со всеми переменными, smoke-проверка обоих вариантов
      (`/actuator/health`, открывается `/`).

## Этап 4. Подсистема аутентификации (`identity`)

- [ ] 4.1 **B** Схема `identity`: `users` (id, role, login, password_hash, display_name,
      email, phone, status, failed_attempts, locked_until, version), `invites`,
      `refresh_tokens`. Инвариант «учитель ровно один».
- [ ] 4.2 **B** Bootstrap учителя из `TEACHERBOX_TEACHER_LOGIN/PASSWORD` при первом старте
      (если пароль не задан — сгенерировать и один раз вывести в лог).
- [ ] 4.3 **B** Выпуск JWT (инфраструктура ключа — в 1.8); access-токен 15 мин (в памяти SPA); refresh-токен — случайный,
      хранится хешем, HttpOnly+SameSite=Strict cookie, ротация, детект повторного использования.
- [ ] 4.4 **B** `POST /api/auth/login|refresh|logout`, защита от перебора (блокировка
      после N неудач), `POST /api/me/password`.
- [ ] 4.5 **B** Учитель: CRUD учеников `/api/teacher/students`, выдача/перевыпуск
      приглашения, деактивация (отзыв всех refresh-токенов).
- [ ] 4.6 **B** Приглашение: `GET /api/auth/invites/{token}`, `POST .../accept`
      (ученик задаёт логин+пароль).
- [ ] 4.7 **B** `identity.api`: `StudentDirectory` (exists/active/displayName),
      `TeacherDirectory` (teacherId), события `StudentRegistered`, `StudentActivated`,
      `StudentDeactivated`.
- [ ] 4.8 **F** `core/auth`: `AuthService` (signals), `authInterceptor` (Bearer + авто-refresh
      при 401), `roleGuard`, восстановление сессии при загрузке приложения.
- [ ] 4.9 **F** Страницы: вход, принятие приглашения, смена пароля; учитель — реестр учеников
      (таблица, создание, приглашение со ссылкой и копированием, деактивация).

## Этап 5. Подсистема учёта оплаты (`billing`)

- [ ] 5.1 **B** Схема `billing`: `student_accounts` (тариф за занятие), `lessons`
      (дата, длительность, цена, статус: COMPLETED/CANCELLED/MISSED_CHARGED, тема),
      `payments` (сумма, дата, способ, комментарий). Валюта инстанса — настройка.
- [ ] 5.2 **B** Правила: баланс = оплаты − начисления; отмена занятия снимает начисление;
      корректировки только через сторнирующие записи (история не переписывается).
- [ ] 5.3 **B** Учитель: `/api/teacher/billing/**` — тарифы, журнал занятий, оплаты,
      баланс по ученикам, должники, доход за период.
- [ ] 5.4 **B** Ученик: `/api/me/billing/**` — свой баланс, занятия, оплаты.
- [ ] 5.5 **B** События `LessonRecorded`, `LessonCancelled`, `PaymentRecorded`;
      слушатель `StudentRegistered` → создать счёт ученика.
- [ ] 5.6 **F** Учитель: сводка по балансам, журнал занятий (быстрое добавление),
      оплаты, отчёт за месяц. Ученик: карточка баланса, история.

## Этап 6. Подсистема домашних заданий (`homework`)

- [ ] 6.1 **B** Схема `homework`: `assignments` (заголовок, markdown-описание, срок),
      `tasks` (задание × ученик, статус ASSIGNED/SUBMITTED/RETURNED/ACCEPTED, оценка,
      комментарий), `submissions` (версии ответов), `attachments` (метаданные файлов).
- [ ] 6.2 **B** Жизненный цикл: выдать (одному/нескольким ученикам) → сдать → вернуть на
      доработку / принять с оценкой. Запрет недопустимых переходов в домене.
- [ ] 6.3 **B** Вложения: загрузка (лимит размера, whitelist типов), хранение через
      `FileStorage` (`/data/files/homework`), скачивание с проверкой прав.
- [ ] 6.4 **B** Учитель: `/api/teacher/homework/**`; ученик: `/api/me/homework/**`.
- [ ] 6.5 **B** События `HomeworkAssigned`, `HomeworkSubmitted`, `HomeworkReviewed`,
      планировщик `HomeworkDueSoon` (за N часов до срока).
- [ ] 6.6 **F** Учитель: список заданий, редактор (markdown + превью), выдача ученикам,
      очередь на проверку, проверка. Ученик: мои задания, сдача с файлами, статус и отзыв.

## Этап 7. Подсистема уведомлений (`notifications`)

- [ ] 7.1 **B** Схема `notifications`: `inbox` (уведомления в ЛК), `channel_links`
      (привязки получателя к Telegram/VK/MAX), `deliveries` (outbox: статус, попытки,
      следующая попытка, ошибка), `preferences`.
- [ ] 7.2 **B** Ядро: `NotificationService` → запись в inbox + постановка доставок
      в outbox; `DeliveryDispatcher` (планировщик, ретраи с экспоненциальной задержкой).
      SPI `MessengerChannel` для внешних каналов.
- [ ] 7.3 **B** Слушатели событий `homework`/`billing`/`identity` → тексты уведомлений
      (шаблоны, русский язык).
- [ ] 7.4 **B** Telegram-бот: Bot API через `RestClient`, long polling (работает без
      публичного URL), привязка через deep-link `t.me/<bot>?start=<token>`, отвязка.
- [ ] 7.5 **B** ЛС мессенджеров: адаптеры VK (сообщения сообщества) и MAX (бот),
      включаются переменными окружения; привязка через одноразовый код.
- [ ] 7.6 **B** REST: `/api/me/notifications` (список, прочитать, прочитать все, счётчик),
      `/api/me/channels` (привязать/отвязать), `/api/teacher/notifications/broadcast`.
- [ ] 7.7 **F** Колокольчик с счётчиком (опрос), страница уведомлений, настройки каналов
      (кнопка «Подключить Telegram», коды для VK/MAX), рассылка от учителя.

## Этап 8. Подсистема интеграции с ИИ (`ai`)

- [ ] 8.1 **B** SPI `LlmClient` + адаптеры: Anthropic Messages API и OpenAI-совместимый
      (OpenAI, OpenRouter, Ollama, LM Studio и др.); выбор провайдера — переменными окружения;
      модуль выключен, если провайдер не настроен.
- [ ] 8.2 **B** Сценарии: генерация черновика ДЗ (тема, уровень, число задач) и черновик
      проверки ответа (комментарий + предлагаемая оценка). Промпты — ресурсы модуля.
- [ ] 8.3 **B** Учёт использования: схема `ai` (`requests`: фича, модель, токены, статус),
      месячный лимит токенов, `GET /api/teacher/ai/usage`.
- [ ] 8.4 **F** Кнопки «Сгенерировать с ИИ» в редакторе ДЗ и «Черновик проверки» на странице
      проверки (frontend сам передаёт тексты — `homework` и `ai` не связаны на бекенде),
      страница использования.

## Этап 9. Эксплуатация и надёжность

- [ ] 9.1 **B** Бэкапы: ежедневный `BACKUP TO` (БД) + архив файлов, ротация, ручной запуск
      и скачивание учителем, инструкция по восстановлению.
- [ ] 9.2 **B** Безопасность: security headers/CSP, rate limiting `/api/auth/**`,
      аудит входов, проверка размеров запросов.
- [ ] 9.3 **F** Страница «Настройки» учителя: статус интеграций (Telegram/VK/MAX/ИИ),
      бэкапы, профиль.
- [ ] 9.4 **D** Логи в stdout (JSON в prod), graceful shutdown, лимиты ресурсов в compose.

## Этап 10. E2E, CI и релиз

- [ ] 10.1 E2E (Playwright) на `compose.single.yaml`: вход учителя, создание ученика,
      принятие приглашения, выдача и сдача ДЗ, запись оплаты, уведомление в ЛК.
- [ ] 10.2 CI (GitHub Actions): verify backend/frontend, сборка обоих вариантов образов, e2e.
- [ ] 10.3 README: установка на сервер/NAS за 5 минут, обновление, бэкап/восстановление,
      настройка Telegram-бота и ИИ.
- [ ] 10.4 Версионирование (SemVer, `CHANGELOG.md`), тег `v1.0.0`.

---

## Будущее (вне v1)

- Расписание занятий и календарь (новый модуль `schedule`), напоминания о занятиях.
- Абонементы/пакеты занятий, онлайн-оплата.
- Вход через Telegram, 2FA для учителя.
- WhatsApp-канал, e-mail канал.
- ИИ-подсказки для учеников с квотами.
