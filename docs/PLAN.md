# Teacher Box plan

Active plan only, in English. Completed releases — [`archive/plans/`](archive/plans/README.md); don't read them
unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section (or `## Next release` until the number is known): goals (2–5 lines),
  new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive. Substeps: `85.1`, `85.2`, …
  Tags: **B** backend, **F** frontend, **D** docker/infra.
- A substep names its entry points — files, classes, endpoints, routes (`schedule/teacher/lesson-details-dialog.ts`,
  `ScheduleService.cancel`) — so the work starts there instead of a repository search.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to Backlog. This file
  keeps only unreleased work and the Backlog.

## Next release

### Stage 84. Documentation for agents

Goal: less context per task and one current source per topic. No product changes.

- [x] 84.1 Nested `backend/AGENTS.md` and `frontend/AGENTS.md` (+ `CLAUDE.md` → `@AGENTS.md`); root `AGENTS.md`
      keeps the core and a "what to read" map.
- [x] 84.2 `docs/adr/README.md` — ADR index with status; design ADRs point to the spec.
- [x] 84.3 `docs/design-system.md` — current UI rules consolidated from ADR-0015, 0017–0027 and checked
      against the code.
- [x] 84.4 `docs/modules/*.md` — one page per module (rules, contract, data, REST, frontend).
- [x] 84.5 Skills `release`, `new-module`, `new-setting` in `.claude/skills/`.
- [x] 84.6 `docs/archive/` — completed plans and the 2026-09-29 design audit.

### Stage 85. Less output and fewer wasted turns for agents

Goal: shorter tool output in agent sessions. No product changes.

- [x] 85.1 **D** `scripts/verify.sh`: full output to `.verify-logs/<step>.log`, one line per step, the log tail
      on failure (`VERIFY_VERBOSE`, `VERIFY_TAIL`).
- [x] 85.2 Targeted tests while iterating: `npm run test:only -- <path>` (frontend), `./mvnw -q test -Dtest=…`
      (backend); the rule in `AGENTS.md` §5.
- [x] 85.3 `.claude/settings.json`: lockfiles not readable; `.ignore` keeps `docs/archive/` and lockfiles out of
      searches.
- [x] 85.4 PostToolUse hook `.claude/hooks/format.mjs`: Prettier on edited frontend and e2e files.
- [x] 85.5 Plan substeps name their entry points; "Context economy" in `CLAUDE.md`.

### Stage 86. Green E2E after 1.6.12–1.6.13

Goal: the CI E2E job passes again; the scenarios follow the UI of 1.6.12–1.6.13.

- [x] 86.1 **F** `e2e/tests/*`: the invite link is the textbox (row buttons «Новая ссылка-приглашение: …» match
      the label too); the bell is a link in `tb-notification-bell`; the teacher sees «Адрес задан
      администратором портала»; the weekly schedule ends with `pi-stop-circle` (DA-066); button heights are
      measured after the dialog grows in.
- [x] 86.2 **F** `styles.scss` `.tb-lesson-actions--stacked .tb-button-group`: equal halves on a 360 px phone
      (`flex: 1 1 0`, `min-width: 0`, 16 px sides) — «Перенести» with its icon was 8 px wider.
- [x] 86.3 **F** `billing/billing-labels.ts`: the status tag of a missed lesson is «Пропуск», the full «Пропуск
      (оплачивается)» is its `title` (`LESSON_STATUS_HINTS`) — the lesson journal of the monthly report fits a
      tablet (`version-1-6-5` «without scrolling sideways»).

## Backlog

Carried over from 1.6.13 (design audit 2026-09-29, `archive/audit/`):
- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation or
"Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times in the
portal time zone; picking a reschedule time from free slots; file check before upload; journal filters in
the URL; prompt on leaving unsaved settings; invitation and first-run fixes; list-detail for the review
queue; filter chips instead of toggles.

Future:
- Two-way Google Calendar sync.
- Холст boards without manual copying — once Холст has a server-side boards API.
- Lesson packages/subscriptions, online payment.
- Telegram login, 2FA for teacher and administrator.
- WhatsApp and e-mail channels.
- AI hints for students with quotas.
