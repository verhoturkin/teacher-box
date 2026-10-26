# 10. Spaced repetition («Повторение»)

Status: proposal. Size: XL. ADR: yes — new module `practice` (skill `new-module`), the scheduling
algorithm, where cards come from. Depends on: 06 (soft — quiz questions can become cards).

## Goal

Students forget what they learned between lessons. The teacher turns material into cards — words,
formulas, rules, mistakes from a reviewed work — and the student practises a few minutes a day;
the portal schedules each card by spaced repetition. The teacher sees who practises and which
cards are hard.

## Decisions for the teacher

1. Card types in v1: «вопрос → ответ» (self-graded: «Не помню / Трудно / Помню / Легко») and
   «ввести ответ» (checked like a quiz short answer). Pictures on cards (from a textbook page)?
2. Decks: per student, per group, shared decks given to many students (like textbooks)?
   Proposed: decks owned by the teacher, given to students and groups; progress is per student.
3. Daily limits: new cards per day (10?), reviews per day (no limit?), reminder time.
4. Sources: by hand, from a reviewed work («в повторение» on a selected fragment), from quiz
   questions the student got wrong (06), AI from a textbook / file / video.
5. Algorithm: FSRS (modern, better retention; open spec) or SM-2 (simple)? Proposed: FSRS-5 with
   default parameters; no per-user optimisation in v1.

## Design

- New module `practice` (`ru.teacherbox.practice`), schema `practice`, depends on `shared`,
  `identity::api` (students, groups), `homework::api` only if cards link back to a task (a UUID is
  enough — no dependency needed). Allowed-dependencies row in AGENTS.md §4.2 and
  `package-info.java`. `ai` does not depend on `practice`: the frontend passes texts to a new
  `AiFeature.CARDS_DRAFT`, same as the homework draft; textbook pages go through `DraftSources`
  as today.
- Data: `decks (id, title, description, created_at, version)`, `deck_members (deck_id, student_id
  | group_id)`, `cards (id, deck_id, position, type, front varchar(2000), back varchar(2000),
  answers json null, image_key null, source_kind, source_id)`, `card_states (card_id,
  student_id, stability, difficulty, due_at, reps, lapses, state NEW|LEARNING|REVIEW|RELEARNING,
  last_review_at)`, `reviews (id, card_id, student_id, rating, reviewed_at, elapsed_days)`.
- Domain `Fsrs` — a pure function `(state, rating, now) → state` with the published default
  weights; tests against reference values from the FSRS spec / reference implementation.
- Due list: `GET /api/me/practice/today` → due reviews + new cards up to the limit, ordered;
  `POST /api/me/practice/cards/{id}/reviews {rating, answer?}`. Group membership by current
  groups (as textbooks: those who leave keep their history).
- Reminders: a job publishes `PracticeDue(studentId, count)` once a day at the reminder time in the
  instance time zone → `notifications` (topic `PRACTICE`, default on, bot button «Повторить» opens
  the portal; a bot practice mode with «Помню / Не помню» buttons — phase 2).
- Teacher stats: per deck and student — streak, reviews in 7 days, retention, hardest cards.
- Backup/reset: `DataReset`, files (card images) in the `practice` namespace.

## Stages

- [ ] **A.1** (B) ADR; module skeleton per skill `new-module` (schema, migrations, reset,
  `ModularityTests`, `SchemaIsolationTests`), allowed dependencies.
- [ ] **A.2** (B) `Fsrs` with reference tests; decks / cards CRUD for the teacher; members; tests.
- [ ] **A.3** (B) Student practice REST, due ordering, limits, access tests (not a member → 404).
- [ ] **A.4** (B) Reminders job, `PracticeDue`, notifications texts and preference.
- [ ] **A.5** (B) Sources: «в повторение» from a reviewed task (homework frontend calls practice
  API with the fragment text and the task id), from wrong quiz answers (06), AI cards draft.
- [ ] **B.1** (F) Teacher: section «Повторение» (or a tab inside «Материалы» — decide with the
  teacher): decks list, deck editor (cards table, import from CSV «вопрос;ответ»), members picker
  (`tb-member-picker`), stats.
- [ ] **B.2** (F) Student: «Повторить сегодня (12)» card on the home, practice screen (card flip,
  four rating buttons, keyboard 1–4 and space, swipe on phones), done screen with streak.
- [ ] **B.3** (F) «В повторение» action in the review page selection menu; AI cards mode.
- [ ] **C.1** Docs: `docs/modules/practice.md`, AGENTS.md module table, wiki page «Повторение»,
  help ru/en, E2E `e2e/tests/practice/`.

## Risks and out of scope

- It is a product of its own — keep v1 small: two card types, no images, no bot mode.
- Anki import (`.apkg`, SQLite inside a zip) — out of scope; CSV import covers most cases.
