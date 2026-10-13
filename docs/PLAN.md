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

## v0.14.3

OpenRouter and DeepSeek as AI providers of their own: one key for models of many vendors; DeepSeek, which takes no
JSON schema answer format. The address, the default model and the answer format are set up by the portal.

### 174. OpenRouter provider (B, F)

- [x] 174.1 **B** `ai`: `TEACHERBOX_AI_PROVIDER=openrouter` — `openrouter/OpenRouterConfiguration` (key required,
  base URL `https://openrouter.ai/api/v1`, default model `openrouter/auto`, header `X-OpenRouter-Title`),
  `OpenAiCompatibleLlmClient` takes extra body fields (`provider.require_parameters`); `AiProperties`,
  `SettingsCatalog` choices.
- [x] 174.2 **F** `ai/ai-usage-page.ts`: provider name «OpenRouter».
- [x] 174.3 Docs: `docs/modules/ai.md`, ADR-0006, `.env.example`, README.

### 175. DeepSeek provider (B, F)

- [x] 175.1 **B** `ai`: `OpenAiCompatibleLlmClient.AnswerFormat` — `JSON_OBJECT` asks for `response_format: json_object`
  with the schema in the system prompt; a 400 naming `response_format` switches a `JSON_SCHEMA` client to it once
  (fixes DeepSeek configured as `openai-compatible`).
- [x] 175.2 **B** `TEACHERBOX_AI_PROVIDER=deepseek` — `deepseek/DeepSeekConfiguration` (key required, base URL
  `https://api.deepseek.com`, default model `deepseek-flash`, `JSON_OBJECT`); `AiProperties`, `SettingsCatalog`.
- [x] 175.3 **F** `ai/ai-usage-page.ts`: provider name «DeepSeek». Docs: `docs/modules/ai.md`, ADR-0006,
  `.env.example`, README.

### 176. Release 0.14.3

- [ ] 176.1 Skill `release`: help articles, E2E spec (`version-0-14-3`, replaces `version-0-14-2`), CHANGELOG, version,
  plan archiving.

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
