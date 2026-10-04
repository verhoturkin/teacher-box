# Teacher Box plan

Active plan only. Written in English. Completed releases live in
[`plan-archive/`](plan-archive/README.md) — do not read it unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section: goals (2–5 lines), new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive (last: **83**). Substeps: `84.1`, `84.2`, …
  Tags: **B** backend, **F** frontend, **D** docker/infra.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next release).
- **Archiving:** in the release commit (last stage: help, E2E, `CHANGELOG.md`, version), move the whole
  release section to `plan-archive/v<version>.md`, add a row to `plan-archive/README.md`, and move
  unfinished items to Backlog. This file keeps only unreleased work and the Backlog.

## Current release

_None planned. Add the next release here (start at stage 84)._

## Backlog

Carried over from 1.6.13 (design audit 2026-09-29, `docs/audit/`):
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
