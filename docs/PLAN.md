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

## v0.14.6

The AI page shows the last 10 requests with «Показать ещё»; the teacher edits the system prompts of the assistant
(homework and review drafts) on the AI page and can return the standard ones — they no longer live only in the
backend resources.

ADR: [0043](adr/0043-editable-system-prompts.md) — system prompts stored in `ai.system_prompts`, the resources are
the defaults (amends ADR-0006).

### 183. Recent AI requests by pages (B, F)

- [x] 183.1 **B** `ai/application/AiUsage`: `UsageReport.recent` — the first 10 requests of the month and
  `moreRecent`; `requests(month, offset)` → `RequestPage {items, hasMore}`; `GET /api/teacher/ai/requests` and
  `GET /api/admin/ai/requests` (`month`, `offset`). **F** `ai/ai-usage-page.ts` and
  `admin/integrations/integrations-page.ts`: «Показать ещё» appends the next 10. Docs: `docs/modules/ai.md`.

### 184. Editable system prompts (B, F)

- [ ] 184.1 **B** `ai/application/SystemPrompts` (migration `V4__system_prompts.sql`, `SystemPromptRepository`):
  the text of a feature — the teacher's one or the default resource; `GET /api/teacher/ai/system-prompts`,
  `PUT …/{feature}` `{text ≤ 10000, version}`, `DELETE …/{feature}` (back to the default); `AiAssistant` takes the
  system prompt from it; in the full reset. ADR-0043, `docs/modules/ai.md`.
- [ ] 184.2 **F** `ai/system-prompts-card.ts` on the AI page: both prompts, «Изменён» tag, a dialog to edit,
  «Вернуть стандартный». Help article `teacher/ai`.

### 185. Release 0.14.6

- [ ] 185.1 Skill `release`: help articles, E2E spec (`version-0-14-6`, replaces `version-0-14-5`), CHANGELOG, version, plan archiving.

## Backlog

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):
- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation or
"Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times in the
portal time zone; picking a reschedule time from free slots; file check before upload; journal filters in
the URL; prompt on leaving unsaved settings; invitation and first-run fixes; list-detail for the review
queue; filter chips instead of toggles.

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
