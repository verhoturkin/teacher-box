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
  address in OpenRouter's rankings), `deepseek/` (since 0.14.3: `https://api.deepseek.com`, default model
  `deepseek-flash`, answer format `JSON_OBJECT`).
- Answer format (`OpenAiCompatibleLlmClient.AnswerFormat`): `JSON_SCHEMA` — `response_format: json_schema`;
  `JSON_OBJECT` — `response_format: json_object` and the schema appended to the system prompt (DeepSeek takes no
  schema). A `JSON_SCHEMA` client switches to `JSON_OBJECT` for good after a 400 that names `response_format`.
- Configured by `TEACHERBOX_AI_*` (provider, model, key, base URL, effort, max tokens, timeout, proxy). Not
  configured → module off, UI hides AI features.
- Responses are always drafts the teacher edits. Refusals handled before reading the answer; output validated
  against the schema (tolerant of Markdown wrapping).
- Monthly token limit (`TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT`, input + output, instance time zone): over the limit
  requests are rejected before calling the provider.
- `ai.requests` stores metadata only (feature, model, status, tokens, duration, error) — never texts.
- Request log by pages of 10 (since 0.14.6): `usage` returns the first page (`recent`, `moreRecent`), `GET requests`
  `?month&offset` the next ones (`RequestPage {items, hasMore}`), for the teacher and the administrator.
- Prompt library (`PromptLibrary`, `ai.prompts`): the teacher's saved prompts — title 1–100, text 1–4000 (no kinds
  since 0.14.1, ADR-0041); listed by title, optimistic locking, in the full reset; kept whether the AI is configured
  or not.
- Prompts are versioned module resources. `AiIntegrationCheck` checks the provider without spending tokens.
- System prompts (`SystemPrompts`, `ai.system_prompts`, [ADR-0043](../adr/0043-editable-system-prompts.md), since
  0.14.6): the teacher rewrites the system prompt of a feature (`HOMEWORK_DRAFT`, `REVIEW_DRAFT`; 1–10000 characters,
  `ai.system-prompt-invalid`); a feature without a row uses its resource (`homework-draft.system.v3`,
  `review-draft.system.v1`). The teacher's text goes to the model as is (no placeholders). Optimistic locking — the
  default prompt has version 0; `DELETE` returns to the default; in the full reset. The user prompts (`*.user.*`,
  with `<request>` / `<answer>`) stay resources.
- Homework draft (`POST homework-draft` `{prompt ≤ 4000, title?, sources?}`, prompts `homework-draft.*.v3`): always
  `{title, description}` — a Markdown text with numbered tasks; no kinds and no HTML pages since 0.14.1
  ([ADR-0041](../adr/0041-homework-without-kinds-board-link.md)).
- Sources of a draft ([ADR-0039](../adr/0039-ai-reads-homework-sources.md), `DraftSources`): `sources` — up to 5 of
  `{type: TEXTBOOK, id, pages?}` (`Textbooks.content`, pages blank — the whole PDF; a picture — `Textbooks.file`) and
  `{type: FILE, assignmentId, id}` (`AssignmentFiles.file`); PDF or png / jpeg / webp / gif only
  (`ai.source-unsupported`), at most 20 pages and 20 MB (`ai.source-too-large`), a missing one — 404
  `ai.source-not-found`. Files of an assignment not saved yet ([ADR-0042](../adr/0042-ai-reads-picked-files.md)):
  the same endpoint as `multipart/form-data` — part `brief` (the JSON request) and parts `files`
  (`DraftSources.Upload`, the same types and limits, counted among the 5 sources; nothing is stored).
  `LlmRequest.sources` go before the prompt: Anthropic — `document` (titled) and `image`
  blocks; OpenAI-compatible — `image_url` data URIs, a PDF drawn page by page by `PdfPictures` (PDFBox, 100 dpi). The
  prompt names them; `ai.requests` keeps no names.
- Tests: Anthropic adapter against a local HTTP server (SDK uses OkHttp); OpenAI-compatible — `MockRestServiceServer`.

## Data, REST

`requests`, `prompts`, `system_prompts`. `/api/teacher/ai/**` (status, usage, requests, homework-draft, review-draft,
`prompts` CRUD, `system-prompts` list / `PUT` / `DELETE` by feature), `/api/admin/ai/**`
(status, usage, requests — metadata).

## Frontend

`features/ai/`: `homework-ai-panel.ts` (the editor's assistant bar over the text: request, «Промты» menu — search, «Сохранить запрос как промт», link to the library; «Опереться на» popover; draft with «Заменить» / «Вставить в конец» / «Отбросить», «Ещё раз»), AI usage page (`/teacher/ai`: usage, the request log with «Показать ещё») with `prompt-library-card.ts` and
`system-prompts-card.ts` (both system prompts, «Изменён», a dialog with «Вернуть стандартный»); embedded via `parts.ts`.
