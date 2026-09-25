# AGENTS.md — Teacher Box

Единый источник правил для любых AI-агентов и людей, работающих с репозиторием
(Claude Code, Codex, Cursor, Copilot и т.д.). `CLAUDE.md` импортирует этот файл.

## 1. Что это за проект

**Teacher Box** — self-hosted портал для репетитора/учителя.

- **Один инстанс = один учитель.** Учитель создаётся при первом запуске из переменных окружения
  и существует всегда в единственном экземпляре. Регистрации «с улицы» нет.
- **Ученики — много.** Учитель заводит ученика и выдаёт ему ссылку-приглашение; ученик сам
  задаёт логин и пароль и попадает в личный кабинет (ЛК).
- Подсистемы бекенда (модули):
  1. `identity` — аутентификация учителя и учеников (приглашения, логин, JWT, refresh-токены).
  2. `billing` — учёт занятий и оплат, баланс ученика, отчёты.
  3. `homework` — домашние задания: выдача, сдача, проверка, вложения.
  4. `notifications` — уведомления: ЛК (inbox), Telegram-бот, ЛС мессенджеров (VK, MAX).
  5. `ai` — интеграция с LLM: генерация заданий, черновик проверки работы.

Пошаговый план — [`docs/PLAN.md`](docs/PLAN.md). Архитектурные решения — [`docs/adr/`](docs/adr).

## 2. Технологии

| Слой | Технология | Версия |
|---|---|---|
| Backend | Java | 25 (LTS) |
| | Spring Boot | 4.1.x |
| | Spring Modulith | 2.1.x |
| | Spring Data JDBC + Flyway | managed by Boot |
| | Spring Security 7 (OAuth2 Resource Server, JWT HS256) | managed by Boot |
| | БД | H2 2.x, file mode, schema-per-module ([ADR-0002](docs/adr/0002-embedded-database.md)) |
| | Сборка | Maven (через `mvnw`) |
| | Тесты | JUnit 6, AssertJ, Mockito, Spring Modulith Test, ArchUnit, JaCoCo |
| Frontend | Angular (standalone, signals, zoneless) | 22.x |
| | PrimeNG + @primeuix/themes (Aura) | 22.x |
| | TypeScript | 6.0.x, `strict` |
| | Тесты | Vitest (через `ng test`), jsdom |
| | Линтер | ESLint + angular-eslint + typescript-eslint (type-checked) |
| Поставка | Docker, Docker Compose | 2 варианта: split и single |

## 3. Структура репозитория

```
teacher-box/
├── AGENTS.md, CLAUDE.md, README.md
├── docs/
│   ├── PLAN.md                  # пошаговый план с чекбоксами
│   └── adr/                     # Architecture Decision Records
├── backend/                     # Spring Boot приложение (Maven)
│   └── src/main/java/ru/teacherbox/
│       ├── TeacherBoxApplication.java
│       ├── shared/              # shared kernel (OPEN-модуль): Ids, Money, CurrentUser, ошибки
│       ├── platform/            # инфраструктура: security, ошибки HTTP, миграции, бэкапы, SPA
│       ├── identity/            # 1. аутентификация
│       ├── billing/             # 2. оплата занятий
│       ├── homework/            # 3. домашние задания
│       ├── notifications/       # 4. уведомления
│       └── ai/                  # 5. интеграция с ИИ
├── frontend/                    # Angular приложение
│   └── src/app/
│       ├── core/                # auth, interceptors, guards, layout, конфиг
│       ├── shared/              # переиспользуемые UI-компоненты, pipes
│       └── features/<module>/   # зеркало модулей бекенда: data-access + teacher/ + student/
├── docker/                      # Dockerfile'ы и nginx.conf
├── compose.split.yaml           # вариант 1: backend + frontend в разных контейнерах
├── compose.single.yaml          # вариант 2: один контейнер
├── .env.example                 # все настраиваемые переменные окружения
├── .githooks/pre-commit         # тесты перед коммитом
└── scripts/verify.sh            # полная проверка (то же, что в pre-commit и CI)
```

## 4. Архитектура и изоляция подсистем

Бекенд — **модульный монолит** на Spring Modulith ([ADR-0001](docs/adr/0001-modular-monolith.md)).
Каждый бизнес-модуль — прямой подпакет `ru.teacherbox`.

### 4.1 Структура модуля

```
<module>/
├── package-info.java      # @ApplicationModule(allowedDependencies = {...}) + @NullMarked
├── api/                   # ПУБЛИЧНЫЙ контракт (@NamedInterface("api")):
│                          #   фасады (interfaces), DTO (records), доменные события (records)
├── domain/                # агрегаты, value objects, правила. Чистая Java, без Spring
├── application/           # use-case сервисы (@Service, @Transactional), реализуют api-фасады
├── persistence/           # Spring Data JDBC репозитории, row-mapping
├── web/                   # REST-контроллеры и их request/response DTO
└── <adapter>/             # внешние интеграции модуля (telegram/, vk/, llm/ ...)
```

### 4.2 Правила изоляции (проверяются тестами — нарушение = красная сборка)

1. **Код:** модуль обращается к другому модулю **только** через его пакет `api`.
   Всё, кроме `api`, — internal. Циклы между модулями запрещены.
   Проверка: `ModularityTests` (`ApplicationModules.verify()`) + ArchUnit-правила.
2. **Разрешённые зависимости** (задаются в `package-info.java`):

   | Модуль | Может зависеть от |
   |---|---|
   | `shared` | — |
   | `platform` | `shared` |
   | `identity` | `shared` |
   | `billing` | `shared`, `identity::api` |
   | `homework` | `shared`, `identity::api` |
   | `notifications` | `shared`, `identity::api`, `billing::api`, `homework::api` (только события) |
   | `ai` | `shared` |

   Бизнес-модули **не зависят** от `platform`; `platform` не знает о бизнес-модулях.
3. **Данные:** у каждого модуля своя схема БД (`identity`, `billing`, `homework`,
   `notifications`, `ai`), свои Flyway-миграции в `db/migration/<module>/` и своя
   таблица истории миграций. **Запрещены** SQL-запросы к чужой схеме, внешние ключи между
   схемами и JOIN между схемами. Между модулями передаются только идентификаторы (UUID).
4. **Взаимодействие:**
   - синхронно — вызов фасада из `api` другого модуля (только чтение/проверки);
   - асинхронно — доменные события (`record` в `api`), публикуемые через
     `ApplicationEventPublisher` и обрабатываемые `@ApplicationModuleListener`.
     События хранятся в Event Publication Registry (переотправка после рестарта).
   - Производители событий ничего не знают о потребителях (например, `homework` не знает
     про `notifications`).
5. **Файлы:** модуль пишет файлы только в свой namespace хранилища (`FileStorage`, `/data/files/<module>/`).
6. **Frontend** повторяет границы: `features/<module>/` не импортирует внутренности другой
   фичи; общие вещи — только из `core/` и `shared/` (правило ESLint `no-restricted-imports`).

### 4.3 Роли и доступ

- `TEACHER` — полный доступ ко всем данным своего инстанса.
- `STUDENT` — только к собственным данным. Любой endpoint, отдающий данные ученика, обязан
  проверять, что `studentId` == текущий пользователь (или роль `TEACHER`). Для каждого такого
  endpoint'а обязателен тест «чужой ученик получает 403/404».
- REST-префиксы: `/api/auth/**` (публичные), `/api/teacher/**` (TEACHER),
  `/api/me/**` (любой аутентифицированный: ЛК), `/api/<module>/**` — по правилам модуля.

## 5. Команды

Все команды — из корня репозитория, если не указано иное.

```bash
# Backend
cd backend && ./mvnw verify            # сборка + все тесты + JaCoCo-пороги + Modulith verify
cd backend && ./mvnw spring-boot:run   # запуск (профиль dev, данные в ./backend/data)
cd backend && ./mvnw test -Dtest=ModularityTests

# Frontend
cd frontend && npm ci
cd frontend && npm run lint            # ESLint (no any, границы фич)
cd frontend && npm test                # Vitest + coverage-пороги (однократный прогон)
cd frontend && npm start               # dev-сервер :4200, прокси /api -> :8080
cd frontend && npm run build           # production-сборка

# Всё сразу (то же делает pre-commit и CI)
./scripts/verify.sh                    # все проверки
./scripts/verify.sh backend|frontend   # только одна часть

# Docker
docker compose -f compose.split.yaml up -d --build    # вариант 1: два контейнера
docker compose -f compose.single.yaml up -d --build   # вариант 2: один контейнер
```

На Windows `./mvnw` → `mvnw.cmd`, bash-скрипты запускаются через Git Bash.

## 6. Соглашения по коду

### 6.1 Общие
- Код, идентификаторы, комментарии в коде, commit-сообщения — **на английском**.
  Документация (`docs/`, README) и тексты UI — **на русском**.
- Никаких секретов в репозитории. Все настройки — через переменные окружения
  (`TEACHERBOX_*`), каждая новая переменная документируется в `.env.example`.
- Время хранится в UTC (`Instant`); часовой пояс учителя — настройка `TEACHERBOX_TIMEZONE`.
- Деньги — целые минорные единицы (`long` копеек) + валюта инстанса. Никаких `double`.

### 6.2 Backend (Java)
- Java 25: `record` для DTO/событий/value objects, `sealed` для закрытых иерархий,
  pattern matching в `switch`. Lombok не используется.
- Только constructor injection; поля `private final`. Никакого `@Autowired` на полях.
- Null-safety: `@NullMarked` (JSpecify) в `package-info.java` каждого пакета; nullable — явно `@Nullable`.
- Идентификаторы — `UUID` (v7, генерируются через `shared.Ids`).
- Агрегаты Spring Data JDBC имеют `@Version` (оптимистическая блокировка).
- Ошибки: доменные исключения из `shared.error` → `ProblemDetail` (RFC 9457) в `platform`.
- Валидация входных DTO — Jakarta Validation на уровне `web`.
- `domain` не импортирует Spring (проверяется ArchUnit).
- Конфигурация модуля — типизированные `@ConfigurationProperties` records с префиксом
  `teacherbox.<module>`.

### 6.3 Frontend (TypeScript/Angular)
- `tsconfig`: `strict: true` + `noImplicitOverride`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`;
  `angularCompilerOptions.strictTemplates: true`.
- **`any` запрещён** в любом виде (`: any`, `as any`, `<any>`, неявный any). Для неизвестных
  данных — `unknown` + type guard. ESLint: `@typescript-eslint/no-explicit-any` и все
  `no-unsafe-*` — `error`. `// eslint-disable` для этих правил запрещён.
- Только standalone-компоненты, `ChangeDetectionStrategy.OnPush`, signals, `inject()`,
  новый control flow (`@if`, `@for`), `input()`/`output()`.
- Компоненты UI — PrimeNG. Собственные компоненты — только если в PrimeNG нет подходящего.
- HTTP-модели — `interface`/`type` в `features/<module>/data-access/*.models.ts`,
  зеркалят DTO бекенда 1:1.
- Роутинг ленивый: `/teacher/**` (учитель), `/cabinet/**` (ЛК ученика), `/login`, `/invite/:token`.

## 7. Тестирование

**Весь код покрывается тестами.** Сборка падает при недостаточном покрытии.

| Часть | Инструмент | Порог |
|---|---|---|
| Backend | JaCoCo (`mvnw verify`) | lines ≥ 90%, branches ≥ 80% |
| Frontend | Vitest coverage (`npm test`) | lines/statements/functions ≥ 90%, branches ≥ 80% |

Обязательные виды тестов backend:
- **Unit** — domain и application (Mockito для портов).
- **Module tests** — `@ApplicationModuleTest` на каждый модуль: поднимается только модуль
  и его разрешённые зависимости (проверка изоляции в рантайме), события — через `Scenario`.
- **Web** — MockMvc/`MockMvcTester`: коды ответов, валидация, авторизация по ролям,
  доступ ученика только к своим данным.
- **Persistence** — `@DataJdbcTest` на H2 с реальными Flyway-миграциями модуля.
- **Architecture** — `ModularityTests` (Modulith verify + генерация документации) и ArchUnit.
- **Adapters** — внешние HTTP API (Telegram, VK, MAX, LLM) — через `MockRestServiceServer`,
  без реальных сетевых вызовов.

Обязательные виды тестов frontend:
- Компоненты — `TestBed` + Vitest, взаимодействие через DOM.
- Сервисы — `HttpTestingController`.
- Guards/interceptors — отдельные тесты.

Тест пишется вместе с кодом (или до него), а не «потом».

## 8. Коммиты

1. **Перед каждым коммитом проходят тесты** затронутых частей: `./scripts/verify.sh`.
   Git-hook `.githooks/pre-commit` делает это автоматически
   (включить: `git config core.hooksPath .githooks`). `--no-verify` не использовать.
2. Формат — Conventional Commits: `feat(billing): record lesson payments`,
   `fix(identity): ...`, `test(...)`, `docs(...)`, `build(...)`, `chore(...)`.
   Scope — имя модуля или `frontend`, `docker`, `platform`.
3. Один коммит — одна логически завершённая единица (обычно подэтап плана).
4. После завершения подэтапа отметить чекбокс в `docs/PLAN.md` в том же коммите.

## 9. Definition of Done (для любой задачи)

- [ ] Код соответствует правилам изоляции (раздел 4) и соглашениям (раздел 6).
- [ ] Тесты написаны, `./scripts/verify.sh` зелёный, пороги покрытия соблюдены.
- [ ] Новые переменные окружения — в `.env.example` и README.
- [ ] Изменение архитектуры — новый ADR в `docs/adr/`.
- [ ] Чекбокс в `docs/PLAN.md` отмечен.
