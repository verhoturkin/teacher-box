# Teacher Box

Self-hosted портал для учителя: ученики, учёт оплаты занятий, домашние задания,
уведомления (ЛК, Telegram, мессенджеры) и помощник на базе ИИ.

**Один инстанс — один учитель.** Ученики входят по приглашению учителя.

> Проект в разработке. План — [docs/PLAN.md](docs/PLAN.md),
> правила разработки — [AGENTS.md](AGENTS.md), решения — [docs/adr](docs/adr).

## Стек

- Backend: Java 25, Spring Boot 4, Spring Modulith, H2 (файловый режим)
- Frontend: Angular 22, PrimeNG 22, TypeScript (strict)
- Поставка: Docker Compose — два контейнера (`compose.split.yaml`) или один (`compose.single.yaml`)
