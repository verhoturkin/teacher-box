# ai

LLM features for the teacher: homework draft and review draft. Depends on: `shared`, `textbooks::api`,
`homework::api` — only to read the sources of a draft ([ADR-0039](../adr/0039-ai-reads-homework-sources.md)); other
texts come from the frontend. Schema `ai`. ADRs: [0006](../adr/0006-ai-integration.md),
[0009](../adr/0009-external-integrations.md). **Load the `claude-api` skill before changing LLM code.**

## Rules

- SPI `LlmClient`; adapters: `anthropic/` (official Java SDK, structured outputs, server-side fallbacks —
  `TEACHERBOX_AI_FALLBACKS`), `openai/` (OpenAI-compatible `/chat/completions` on `RestClient`, JSON Schema in
  `response_format`), `gemini/` (Gemini API key via the OpenAI-compatible endpoint; needs `TEACHERBOX_AI_PROXY`
  from Russia), `openrouter/` (since 0.14.3: the OpenAI-compatible client with `https://openrouter.ai/api/v1`,
  default model `openrouter/auto`, `provider.require_parameters: true` in the body so the JSON schema is never
  silently ignored, title header `X-OpenRouter-Title: Teacher Box` and no referer — it would publish the portal's
  address in OpenRouter's rankings).
- Configured by `TEACHERBOX_AI_*` (provider, model, key, base URL, effort, max tokens, timeout, proxy). Not
  configured → module off, UI hides AI features.
- Responses are always drafts the teacher edits. Refusals handled before reading the answer; output validated
  against the schema (tolerant of Markdown wrapping).
- Monthly token limit (`TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT`, input + output, instance time zone): over the limit
  requests are rejected before calling the provider.
- `ai.requests` stores metadata only (feature, model, status, tokens, duration, error) — never texts.
- Prompt library (`PromptLibrary`, `ai.prompts`): the teacher's saved prompts — title 1–100, text 1–4000 (no kinds
  since 0.14.1, ADR-0041); listed by title, optimistic locking, in the full reset; kept whether the AI is configured
  or not.
- Prompts are versioned module resources. `AiIntegrationCheck` checks the provider without spending tokens.
- Homework draft (`POST homework-draft` `{prompt ≤ 4000, title?, sources?}`, prompts `homework-draft.*.v3`): always
  `{title, description}` — a Markdown text with numbered tasks; no kinds and no HTML pages since 0.14.1
  ([ADR-0041](../adr/0041-homework-without-kinds-board-link.md)).
- Sources of a draft ([ADR-0039](../adr/0039-ai-reads-homework-sources.md), `DraftSources`): `sources` — up to 5 of
  `{type: TEXTBOOK, id, pages?}` (`Textbooks.content`, pages blank — the whole PDF; a picture — `Textbooks.file`) and
  `{type: FILE, assignmentId, id}` (`AssignmentFiles.file`); PDF or png / jpeg / webp / gif only
  (`ai.source-unsupported`), at most 20 pages and 20 MB (`ai.source-too-large`), a missing one — 404
  `ai.source-not-found`. `LlmRequest.sources` go before the prompt: Anthropic — `document` (titled) and `image`
  blocks; OpenAI-compatible — `image_url` data URIs, a PDF drawn page by page by `PdfPictures` (PDFBox, 100 dpi). The
  prompt names them; `ai.requests` keeps no names.
- Tests: Anthropic adapter against a local HTTP server (SDK uses OkHttp); OpenAI-compatible — `MockRestServiceServer`.

## Data, REST

`requests`, `prompts`. `/api/teacher/ai/**` (status, usage, homework-draft, review-draft, `prompts` CRUD), `/api/admin/ai/**` (status,
usage metadata).

## Frontend

`features/ai/`: `homework-ai-panel.ts` (the editor's assistant: library chips and select, request, draft with «Заменить» / «Вставить в конец» / «Отбросить», «Сохранить промт»), AI usage page (`/teacher/ai`) with `prompt-library-card.ts`; embedded via `parts.ts`.
