# Roadmap proposals

Detailed implementation plans for features that are **not scheduled yet** (written 2026-10-26, after
the 0.34.0 plan). Each file is one feature, self-contained, so a fresh session can start from it.

How to use:

- A plan here is a proposal. Before work starts, settle its «Decisions for the teacher» with the
  user, then move its stages into `docs/PLAN.md` as a release section with global stage numbers
  (the next free number after the active plan) and delete or shorten the file here.
- Stages below are lettered (`A`, `B`, …) and substeps numbered inside them (`A.1`); tags as in
  PLAN.md: **B** backend, **F** frontend, **D** docker/infra.
- Entry points are real files and classes as of 0.34.0; check them before relying on them.
- Every plan follows AGENTS.md: module isolation (§4.2), tests first, help articles in every
  language, `docs/wiki/` for what users see, an ADR for an architecture change.

| # | Feature | Modules | Size | ADR | Depends on |
|---|---|---|---|---|---|
| 01 | Lesson notes and summary — moved to [`PLAN.md`](../PLAN.md) v0.37.0 (stages 304–310) | schedule, ai, notifications | M | no | — |
| 02 | [Student progress report](02-progress-report.md) | schedule, homework, billing, frontend | L | yes | 01 (soft) |
| 03 | [Lesson packages](03-lesson-packages.md) | billing, notifications | L | yes | — |
| 04 | [Invoices with a payment QR](04-invoices.md) | billing, notifications | M | yes | 03 (soft) |
| 05 | [Parent access](05-parent-access.md) | identity, every module, platform | XL | yes | — |
| 06 | Auto-checked quizzes — moved to [`PLAN.md`](../PLAN.md) v0.39.0 (stages 318–327) | homework, ai | L | yes | — |
| 07 | Installable app and web push — moved to [`PLAN.md`](../PLAN.md) v0.38.0 (stages 312–317) | frontend, notifications | M | yes | — |
| 08 | [Self-booking of free slots](08-self-booking.md) | schedule, notifications | L | yes | — |
| 09 | [Calls: «ученик ждёт» and recording](09-calls-waiting-recording.md) | meetings, notifications, docker | L | yes | — |
| 10 | [Spaced repetition](10-spaced-repetition.md) | new module `practice`, ai | XL | yes | 06 (soft) |

Sizes: S — one session, M — 2–3 substeps, L — a release of its own, XL — two releases.

Suggested order: 01 → 02 (phase 1) → 03 → 04 → 07 → 06 → 08 →
05 → 02 (phase 2, parents) → 09 → 10. The first five close the gap between «schedule and money»
and «how the student is doing»; 05 is the most invasive and should come after the data it exposes
exists.
