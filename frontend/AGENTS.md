# frontend/AGENTS.md — Angular frontend

Loaded when working under `frontend/`. The root [`AGENTS.md`](../AGENTS.md) still applies. **UI rules —
[`docs/design-system.md`](../docs/design-system.md)** (read the relevant section before touching templates or
styles); UI wording — [`docs/glossary.md`](../docs/glossary.md). Module facts — [`docs/modules/`](../docs/modules).

## Structure

```
src/app/
├── core/          # auth, http (errors, ProblemDetail), layout (shell, nav, mobile.ts), theme, a11y, snackbar, routing, i18n, portal
├── shared/        # ui/ (page-header, empty-state, load-state, fold-card, confirmation, field-errors…), dates, money, text, forms
└── features/<m>/  # mirrors backend modules: data-access/ + teacher/ + student/ + home/ (+ admin, help, settings, home)
src/testing/       # @testing/setup, @testing/dom, @testing/*-fixtures (tests only)
```

- Aliases: `@core/*`, `@shared/*`, `@features/*`, `@testing/*` (tests only).
- **Feature boundaries** (ESLint `no-restricted-imports`): another feature only via `@features/<name>`
  (`index.ts`: pages for lazy routes) or `@features/<name>/parts` (`parts.ts`: widgets, panels, API, types —
  no pages, so they don't leak into other bundles). Shared code only from `core/` and `shared/`. Home widgets
  live in their features; `features/home` only assembles them.
- Lazy routes: `/teacher/**`, `/cabinet/**` (student), `/admin/**`, `/login`, `/invite/:token`.
- HTTP models — `interface`/`type` in `features/<m>/data-access/*.models.ts`, 1:1 with backend DTOs.
- Status → label/severity maps — `features/<m>/*-labels.ts`.
- User help (Russian) — `features/help/articles/{teacher,student,admin}.ts`; a UI change updates its article.

## Conventions

- `tsconfig`: `strict` + `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
  `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`; `strictTemplates`.
- **`any` is forbidden** in any form (`: any`, `as any`, `<any>`, implicit). Unknown data — `unknown` + type
  guard. ESLint `no-explicit-any` and all `no-unsafe-*` are `error`; disabling them is forbidden. PrimeNG row
  templates are typed with `tbRowType`.
- Standalone components, `ChangeDetectionStrategy.OnPush`, signals, `inject()`, `input()`/`output()`, control
  flow `@if`/`@for`. Angular 21 is zoneless; `ng test` = Vitest.
- UI components — PrimeNG 21; custom ones only when PrimeNG has nothing suitable. Themes:
  `providePrimeNG({ theme: { preset } })` from `@primeuix/themes`.
- **Never upgrade PrimeNG / @primeuix/themes / primeicons to 22 / 3 / 8** (commercial PrimeUI licence,
  [ADR-0007](../docs/adr/0007-frontend-stack-licensing.md)); Angular — 21.x only. Install with
  `npx -y npm@11 ci|install` (npm ≥ 11).
- **React island** ([ADR-0028](../docs/adr/0028-excalidraw-boards.md)): React and Excalidraw are imported only in
  `features/boards/editor/` (ESLint), lazily via `excalidraw-loader.ts`; tests use `@testing/excalidraw-fake`.
- Section data — `LoadState` + `tb-load-state`, load requests via `quietContext()`; confirmations —
  `dangerConfirmation` / `safeConfirmation`; request actions — `[loading]` (`shared/ui/busy.ts`).

## Tests

Stack: Vitest (jsdom) via `ng test`; lint — ESLint + angular-eslint + typescript-eslint (type-checked), Prettier,
knip. Gate (`npm test`, coverage): lines / statements / functions ≥ 90 %, branches ≥ 80 %.

- Components — `TestBed` + Vitest, interaction through the DOM (`@testing/dom`).
- Services — `HttpTestingController`; guards and interceptors — separate tests.
- Edited `src/**/*.{ts,html,scss}` files are formatted by Prettier automatically (Claude Code hook); other agents
  run `npm run format`.
- Common setup — `testProviders(...)` from `@testing/setup` (HTTP testing, router, PrimeNG, `MessageService`);
  fixtures — `@testing/*-fixtures`.

```bash
npx -y npm@11 ci   # install
npm run lint       # ESLint (no any, boundaries) + Prettier check + knip (dead code)
npm test           # Vitest + coverage gates (whole suite)
npm run test:only -- src/app/features/billing   # only these specs (a dir or file), dot reporter, no coverage
npm run build      # production build
npm start          # dev server :4200, /api -> :8080
```
