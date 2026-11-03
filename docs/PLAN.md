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
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next
  release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to
  Backlog. This file keeps only unreleased work and the Backlog.

## Next release

### Stage 355 — fixes after 0.44.0

- [x] **355.1 F** Open assignment on a very wide window: the task column stops at 48 rem and the
  students column follows it instead of sitting at the far edge with empty space between
  (`homework/teacher/assignment-page.ts`).

### Stage 362 — student tags for the AI

Goals: the teacher defines tags (a name and an ordered list of values: «Уровень английского» A1–C2,
«Класс» 1–11) and sets one value per tag on each student. Tags are the teacher's only: students,
bots and the administrator never see them. Tags marked «Учитывать в ИИ» go to the homework, quiz and
review drafts as defaults that the teacher's own request overrides. Sketches: canvas «Ученики —
эскизы» (list, card tab, phone, elements), canvas «Настройки и аккаунт» board 16 (`Tags`), canvas
«Задания» boards 13 and 22 (`AiEditor`, `PhoneAi`). Out of scope: tags on groups, a history of
values, per-value hints for the AI.

New ADR-0055 «Теги учеников»: tags live in `identity`; `ai` keeps no dependency on it — the frontend
sends the context of the recipients with the request, as it does for the lesson summary.

- [x] **362.1 B** Tag definitions in `identity`: migration `V3__student_tags.sql` (`tags`: id, name
  1–60, `use_in_ai`, position, version; `tag_values`: id, tag id, label 1–40, position;
  `student_tags`: student id, tag id, value id, one row per tag); `StudentTagService` with CRUD and
  reorder, optimistic locking, removing a used value clears it from students (the answer says how
  many); REST `/api/teacher/tags` (list, create, `PUT`, `DELETE`); in `IdentityDataReset`.
  Controller tests first: the teacher only, a student and the administrator get 403. ADR-0055 and
  `docs/modules/identity.md` in the same commit.
- [x] **362.2 B** Values on a student: `PUT /api/teacher/students/{id}/tags` `{tagId →
  valueId|null}` (`StudentAdminController`), tags in the teacher's `StudentView`, a `tag` filter on
  the student list; never in `/api/me`, the student's views or `identity::api.StudentSummary` (test:
  a student reading their own profile sees no tags).
- [x] **362.3 B** AI context: `context` — up to 10 `{name ≤ 60, value ≤ 120}` pairs — in the
  `homework-draft`, `quiz-draft` and `review-draft` requests (`AiViews`, `AiAssistant`); the user
  prompts (`homework-draft.user.v4`, `quiz-draft.user.v2`, `review-draft.user.v2`) put it between
  `<students>` tags as data with the rule «defaults; the teacher's request wins» — in the user
  prompt, so a rewritten system prompt keeps it. Several values of one tag go as «7 · 8».
  `ai.requests` stores no context. `docs/modules/ai.md`.
- [x] **362.4 F** Settings category «Ученики» (`settings/settings-categories.ts` 6 → 7, after
  «Занятия»): card «Теги учеников» with the list, the tag dialog (name, values as chips with drag
  order, «Учитывать в ИИ» switch, delete), templates CEFR / «Класс» / «Цель» on the empty state
  (sketch `Tags`). Phone and tablet follow the existing settings list → detail.
- [x] **362.5 F** Student card tab «Теги» between «Оплаты» and «Профиль»
  (`identity/students/card-tabs.ts` `CARD_TABS`, `?tab=tags`; the group card gets none): one M3 list
  row per tag — lead `auto_awesome` on tertiary container for AI tags, `sell` otherwise — with an
  outlined select («Не задан» first), saved on change; «Что увидит ИИ» beside it; «Настроить теги»
  link; empty state «Тегов пока нет» → «Создать теги» (the tab is always there). The list rows stay
  as they are — no tags in the row or the card header. The list gets one filter chip «Теги» with a
  menu tag → value (student counts), showing «Уровень: B1» when set, hidden while no tag exists,
  kept as `?tag=<valueId>`; it hides groups; on the phone the set chip goes first with «×»
  (`roster.ts`, `students-page.ts`). Canvas «Ученики — эскизы».
- [x] **362.6 F** «Учитываю об учениках» chips in `ai/homework-ai-panel.ts` (homework and quiz
  modes) and the review draft in `homework/teacher/review-form.ts`: built from the recipients' AI
  tags, each chip removable for this request, a mixed value shown in the warning tone with «у 4 — 7,
  у 2 — 8» and a menu to pick one value; the phone sheet shows the chips in one scrolling row
  (sketches `AiEditor`, `PhoneAi`). `docs/screens.md`, `docs/design-system.md` if a new pattern
  appears.
- [x] **362.7** User docs and help: `docs/wiki/AI-assistant.md` (how tags shape drafts) and a short
  «Теги учеников» section in the students' help article in Russian and English; glossary terms
  «тег», «значение тега» in `docs/glossary.md`; E2E in `e2e/tests/` — the teacher creates a tag,
  sets it on a student, the student's cabinet shows no tag.

## Repository maintenance

### Stage 336 — GitHub releases and README screenshots

- [x] **336.1** Publish missing GitHub releases for existing version tags using their
  `CHANGELOG.md` entries; refresh the nine `docs/assets/readme/*.png` screenshots from a
  disposable instance of v0.41.0 with fictional students and verify the README image links.

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Voice answers («Записать голос»): `MediaRecorder` in the answer panel of `my-task-page.ts` would upload
a record as an attachment. Missing: the browser records `audio/webm` and `FilePolicy` accepts no `webm` (a one-line
addition, plus `ACCEPTED_FILES`); decided against for now.

Colours of students and groups after 0.20.0: rows without an avatar (the student table of the
monthly report, homework and board lists by name) and the options of student / group selects.

`shared/ui/fold-card.ts` (`tb-fold-card`) is used by no page since 247.2: remove it or find it a use.

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):

- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation
or "Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times
in the portal time zone; picking a reschedule time from free slots; file check before upload;
journal filters in the URL; prompt on leaving unsaved settings; invitation and first-run fixes;
list-detail for the review queue; filter chips instead of toggles. _List-detail for the review
queue, «Следующая работа», filter chips and search in long lists are planned in the redesign (stages
237, 242, 248)._

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
