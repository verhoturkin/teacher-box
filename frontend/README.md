# Teacher Box — frontend

Angular 21 LTS + PrimeNG 21 (MIT). Правила — в корневом [AGENTS.md](../AGENTS.md).

```bash
npx -y npm@11 ci      # установка зависимостей (нужен npm >= 11, см. ADR-0007)
npm start             # dev-сервер http://localhost:4200, /api проксируется на :8080
npm run lint          # ESLint: запрет any, границы фич
npm test              # Vitest + покрытие (пороги 90/80)
npm run build         # production-сборка в dist/teacher-box/browser
```

Структура `src/app`:

- `core/` — инфраструктура приложения: HTTP, локаль, тема, layout'ы, маршрутизация;
- `shared/` — переиспользуемые UI-компоненты;
- `features/<module>/` — фичи, зеркалят модули бекенда; наружу — только через `index.ts`.

Алиасы импортов: `@core/*`, `@shared/*`, `@features/*`, `@testing/*` (только в тестах).
