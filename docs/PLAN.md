# Teacher Box plan

Active plan only, in English. Completed releases — [`archive/plans/`](archive/plans/README.md);
don't read them unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section (or `## Next release` until the number is known): goals (2–5
  lines), new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive. Substeps: `85.1`, `85.2`, … Tags: **B**
  backend, **F** frontend, **D** docker/infra.
- A substep names its entry points — files, classes, endpoints, routes
  (`schedule/teacher/lesson-details-dialog.ts`, `ScheduleService.cancel`) — so the work starts there
  instead of a repository search.
- Every new substep carries a complexity mark — *simple* (mechanical edit, docs, config) or
  *complex* (architecture, big refactor, subtle bug) — so the user or an orchestrating agent picks
  the model: smaller for simple, larger for complex. Several complex substeps do not share a
  session.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next
  release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to
  Backlog. This file keeps only unreleased work and the Backlog.

## Next release

Goals: the plan editor's AI matches the homework editor's; «промпт» is spelt right; the lesson
summary is one card, not sent, with no next-lesson topic.

### 469. Teacher's check of 0.62.1 (F)

- [x] 469.1 **F** The plan editor's header action is the homework editor's tonal «ИИ-помощник»
  (an icon alone on a phone) instead of the outlined «С ИИ»
  (`textbooks/teacher/lesson-plan-editor-page.ts`); the plan's prompt menu gets «Сохранить запрос
  как промпт» (`ai/lesson-plan-ai-panel.ts`). «промт» → «промпт» in the interface, help, wiki,
  glossary, ADRs and module docs; «серии» → «повтор» in the deactivation help (glossary).
  *simple*
- [x] 469.2 **F** «Что прошли» of a lesson with a plan: the status line, its hint and the text
  button «Не всё по плану» give way to a connected button group «По плану | Не всё по плану» beside
  the heading, as «Итог» (`schedule/teacher/lesson-summary-section.ts`); «Черновик» only under «Не
  всё по плану». *simple*
- [x] 469.3 **B F** The lesson summary is one `tb-list` card like «Итог» and «ДЗ»
  (`schedule/teacher/lesson-summary-section.ts`): it saves itself (`EditorAutosave`), no
  «Сохранить», no «Отправить ученику(ам)», no «Тема следующего занятия». `ScheduleService.
  updateSummary` takes `{summary}`; `shareSummary`, `LessonSummaryShared`, `LESSON_SUMMARY` notices
  and the bot's share step are gone; migrations `schedule/V11__drop_next_plan.sql`,
  `notifications/V5__drop_lesson_summary_notices.sql`; AI prompt `lesson-context.v2`; ADR-0073.
  *complex*

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Left from 0.62.1 (468): a video with captions in one language was checked live only by the
teacher; «Мои запросы» of the plan's AI pane was not checked live (no AI on the dev instance).
A deactivated student who stays a member of a group may come back into lessons a group series
generates later (`ScheduleDirectory.membersOf` does not filter by access) — check and decide.

Left from 0.62.0 (467.6): the AI side pane of the lesson-plan editor was not checked live; neither
was the course saved from Профиль surviving a reload.

Left from 0.57.0 (449.1): the student card actions (3 buttons, 371 px) overflow a 375 px phone;
the schedule toolbar → calendar gap and the `.tb-ops` section margins are child margins, not the
parent's gap; lesson rows, student-side cards with data and the teacher homework / Materials lists
were measured only empty; «Позвать» and the tab ripple on touch were not checked live.

Decided against on 2026-11-15 (don't propose again without a new reason): `no-store` of homework
attachments stays (a shared computer must not keep files); one language of the dictionaries per
load; Caddy alone instead of Caddy in front of nginx; colours on the board list; times in the
portal time zone; search in the remaining long lists and list-detail for the review queue.
