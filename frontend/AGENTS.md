# frontend/AGENTS.md — Angular frontend

Loaded when working under `frontend/`. The root [`AGENTS.md`](../AGENTS.md) still applies. **UI rules —
[`docs/design-system.md`](../docs/design-system.md)** (read the relevant section before touching templates or
styles: `grep -n '^##' docs/design-system.md` for the outline, then Read with `offset`/`limit` — never
read it whole); UI wording — [`docs/glossary.md`](../docs/glossary.md) (grep the term). Module
facts — [`docs/modules/`](../docs/modules).

## Structure

```
src/app/
├── core/          # auth, http (errors, ProblemDetail), layout (shell, nav, mobile.ts), theme, a11y, snackbar, routing, i18n, portal
├── shared/        # ui/ (page-header, empty-state, load-state, fold-card, confirmation, field-errors…), dates, money, text, forms
└── features/<m>/  # mirrors backend modules: data-access/ + teacher/ + student/ + home/ (+ admin, help, settings, home, students, account)
src/testing/       # @testing/setup, @testing/dom, @testing/*-fixtures (tests only)
```

- Aliases: `@core/*`, `@shared/*`, `@features/*`, `@testing/*` (tests only).
- **Feature boundaries** (ESLint `no-restricted-imports`): another feature only via `@features/<name>`
  (`index.ts`: pages for lazy routes) or `@features/<name>/parts` (`parts.ts`: widgets, panels, API, types —
  no pages, so they don't leak into other bundles). Shared code only from `core/` and `shared/`. Home widgets
  live in their features; `features/home` only assembles them.
- **Feature directions** ([ADR-0058](../docs/adr/0058-frontend-feature-directions.md)): a feature
  imports only the features of its row — the table in `eslint.config.js`, mirrored here. Tests and
  `import type` count. `scripts/import-cycles.mjs` also fails on a cycle between features.

  | Layer | Feature | May import |
  |---|---|---|
  | base | `help` | — |
  | base | `identity` | `help` |
  | business | `ai`, `boards`, `meetings`, `notifications` | base |
  | business | `textbooks` | base, `boards` |
  | business | `billing` | base, `notifications` |
  | business | `homework` | base, `ai`, `boards`, `textbooks` |
  | business | `schedule` | base, `ai`, `boards`, `homework`, `meetings` |
  | composition | `account`, `admin`, `home`, `materials`, `settings`, `students` (`gallery` from stage 371) | base, any business feature; `admin` also `settings` |

  Nothing imports a composition feature (except `admin` → `settings`). A new feature gets a row; a
  new arrow changes the table in both places and must not close a cycle. A business feature that
  needs data of a feature above it declares an input, and the route (`app.routes.ts`) or a
  composition feature passes the data.
- Lazy routes: `/teacher/**`, `/cabinet/**` (student), `/admin/**`, `/login`, `/invite/:token`.
- HTTP models — `interface`/`type` in `features/<m>/data-access/*.models.ts`, 1:1 with backend DTOs.
- Status → label/severity maps — `features/<m>/*-labels.ts`.
- **No UI text in templates or code** ([ADR-0035](../docs/adr/0035-interface-languages.md)): dictionaries
  `features/<m>/i18n/{ru,en}.ts` (`T` from `i18n/texts.ts`), common words `SHARED_T`, the frame `CORE_T`; a new
  text goes into `ru.ts` and `en.ts` together (design-system §14). Write each version independently
  from the same intent, using natural Russian and British English. `Translation<typeof ru>` shares
  keys and parameter types, not wording or sentence structure. Review English copy on its own and
  keep action labels consistent with English help and server messages (`docs/glossary.md`).
- User help — `features/help/articles/{teacher,student,admin}/{ru,en}/<topic>.ts`; a UI change
  updates its article in every language.

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
- **Theme tokens of used components only** (stage 372): the preset is built on
  `core/theme/aura-base.ts`, not on `@primeuix/themes/aura`. The first `primeng/<module>` import in
  `src/app` adds its `@primeuix/themes/aura/<component>` there, the last removed one drops it;
  `aura-base.spec.ts` names what is missing or unused.
- **Never upgrade PrimeNG / @primeuix/themes to 22 / 3** (commercial PrimeUI licence,
  [ADR-0007](../docs/adr/0007-frontend-stack-licensing.md)); Angular — 21.x only. Install with
  `npx -y npm@11 ci|install` (npm ≥ 11).
- **React island** ([ADR-0028](../docs/adr/0028-excalidraw-boards.md)): React and Excalidraw are imported only in
  `features/boards/editor/` (ESLint): `excalidraw-island.ts`, loaded lazily by `excalidraw-loader.ts`; tests
  use `@testing/excalidraw-fake`.
- Icons — Material Symbols Rounded classes `tb-i tb-i-<name>` (design-system §4 «Icons», ADR-0046): after adding or
  removing an icon run `npm run icons` and commit `core/theme/{icons,prime-icons}.scss` and `symbols.woff2`.
- **Colour library stays out of the initial bundle** (stage 376, ADR-0034): only
  `core/theme/color-engine.ts` imports `@material/material-color-utilities`, and the app reaches it
  through `import()` or a lazy screen (`scripts/initial-imports.mjs`, part of `npm run lint`). After
  changing the engine, `color.ts`, `computed-colors.ts` or the library version run `npm run colors`
  and commit `core/theme/generated-colors.ts` (`generated-colors.spec.ts` fails until then).
- **Design gallery** (`/gallery`, development builds, ADR-0059): a new shared component or variant
  adds its sample `features/gallery/<section>/<sample>.ts` in the same commit.
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
