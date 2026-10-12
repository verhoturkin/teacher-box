# ai

LLM features for the teacher: homework draft and review draft. Depends on: `shared`, `textbooks::api`,
`homework::api` — only to read the sources of a draft ([ADR-0039](../adr/0039-ai-reads-homework-sources.md)); other
texts come from the frontend. Schema `ai`. ADRs: [0006](../adr/0006-ai-integration.md),
[0009](../adr/0009-external-integrations.md). **Load the `claude-api` skill before changing LLM code.**

## Rules

- SPI `LlmClient`; adapters: `anthropic/` (official Java SDK, structured outputs, server-side fallbacks —
  `TEACHERBOX_AI_FALLBACKS`), `openai/` (OpenAI-compatible `/chat/completions` on `RestClient`, JSON Schema in
  `response_format`), `gemini/` (Gemini API key via the OpenAI-compatible endpoint; needs `TEACHERBOX_AI_PROXY`
  from Russia).
- Configured by `TEACHERBOX_AI_*` (provider, model, key, base URL, effort, max tokens, timeout, proxy). Not
  configured → module off, UI hides AI features.
- Responses are always drafts the teacher edits. Refusals handled before reading the answer; output validated
  against the schema (tolerant of Markdown wrapping).
- Monthly token limit (`TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT`, input + output, instance time zone): over the limit
  requests are rejected before calling the provider.
- `ai.requests` stores metadata only (feature, model, status, tokens, duration, error) — never texts.
- Prompt library (`PromptLibrary`, `ai.prompts`): the teacher's saved prompts — title 1–100, text 1–4000, kind
  (`WRITTEN` / `BOARD` / `INTERACTIVE`, blank — any); listed by title, optimistic locking, in the full reset; kept
  whether the AI is configured or not.
- Prompts are versioned module resources. `AiIntegrationCheck` checks the provider without spending tokens.
- Homework draft (`POST homework-draft` `{kind, prompt ≤ 4000, title?, look?}`, prompts `homework-draft.*.v2` +
  `homework-kind.<kind>.v1`): the kind's rules go into the system prompt; `INTERACTIVE` asks for `{title,
  description, html}` — one sandboxed page in the portal's `look` (font, `#rrggbb` primary / surface / text; blank —
  `PageLook.DEFAULT`) that reports with `teacherbox.result(...)`. A page that loads anything (`<script src>`, `<link>`,
  `<iframe>`, `<object>`, `<embed>`, `<base>`, external `src` / `href` / `url()`, `@import`) or is over 200 000
  characters is an invalid answer.
- Tests: Anthropic adapter against a local HTTP server (SDK uses OkHttp); OpenAI-compatible — `MockRestServiceServer`.

## Data, REST

`requests`, `prompts`. `/api/teacher/ai/**` (status, usage, homework-draft, review-draft, `prompts` CRUD), `/api/admin/ai/**` (status,
usage metadata).

## Frontend

`features/ai/`: `homework-ai-panel.ts` (the editor's assistant: library chips and select, request, draft with «Заменить» / «Вставить в конец» / «Отбросить», «Сохранить промт»; `page-look.ts` reads the portal's colours and font for interactive pages), AI usage page (`/teacher/ai`) with `prompt-library-card.ts`; embedded via `parts.ts`.
