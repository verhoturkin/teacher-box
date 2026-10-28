# ai

LLM features for the teacher: homework draft, quiz questions draft, review draft and lesson summary draft. Depends on: `shared`,
`textbooks::api`,
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
  0.14.6): the teacher rewrites the system prompt of a feature (`HOMEWORK_DRAFT`, `QUIZ_DRAFT`, `REVIEW_DRAFT`, `LESSON_SUMMARY`; 1–10000 characters,
  `ai.system-prompt-invalid`); a feature without a row uses its resource (`homework-draft.system.v4`,
  `quiz-draft.system.v1`, `review-draft.system.v1`, `lesson-summary.system.v1`). The teacher's text goes to the model as is (no placeholders). Optimistic locking — the
  default prompt has version 0; in the UI (0.34.0) «Вернуть стандартный» is in the «⋮» of the edit dialog's header; `DELETE` returns to the default; in the full reset. The user prompts (`*.user.*`,
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
  A video ([ADR-0047](../adr/0047-video-links-and-transcripts.md), 0.19.0): `{type: VIDEO, title?, url,
  transcript}` — the transcript the frontend has (new or saved assignment), `DraftSources.VideoTranscript` →
  `LlmSource` `text/plain` «Расшифровка видео «title» (url)»; Anthropic — a text `document`, OpenAI-compatible — a
  text part (DeepSeek reads it too); counted among the 5 sources. `homework-draft.system.v4` asks to build the tasks
  on what the video says and give the `[m:ss]` of each fragment.
  `LlmRequest.sources` go before the prompt: Anthropic — `document` (titled) and `image`
  blocks; OpenAI-compatible — `image_url` data URIs, a PDF drawn page by page by `PdfPictures` (PDFBox, 100 dpi). The
  prompt names them; `ai.requests` keeps no names.
- Quiz questions draft (`POST quiz-draft`, JSON or `multipart/form-data` as the homework draft, the same request and
  `sources`, prompts `quiz-draft.*.v1`, 0.39.0, [ADR-0052](../adr/0052-auto-checked-quizzes.md)): `{questions: [...]}`
  with the six types. `ai` does not know `homework` internals: every draft goes through the facade
  `homework::api.QuizDrafts`, which applies the same rules as saving (limits, ids, a correct option) and drops what
  fails; a draft with no valid question is an empty list. The answer is never saved: the editor shows it with the key
  and the teacher appends it to the questions or replaces them, then saves the assignment. The enum value
  `QUIZ_DRAFT` is allowed in `system_prompts` by migration `V3__quiz_draft_feature.sql`.
- Lesson summary draft (`POST lesson-summary` `{topic ≤ 200?, words ≤ 2000?, assignmentTitles[≤ 20]?}` → `{summary}`,
  prompts `lesson-summary.*.v1`, since 0.37.0): a short Markdown «Что прошли» from the topic, the titles of the
  assignments given at the lesson and the teacher's words (between `<words>` tags, data only); at least the topic or the
  words must be non-blank. `ai` does not depend on `schedule`: the frontend sends the texts. The enum value
  `LESSON_SUMMARY` is allowed in `system_prompts` by migration `V2__lesson_summary_feature.sql`.
- Tests: Anthropic adapter against a local HTTP server (SDK uses OkHttp); OpenAI-compatible — `MockRestServiceServer`.

## Data, REST

`requests`, `prompts`, `system_prompts`. `/api/teacher/ai/**` (status, usage, requests, homework-draft, quiz-draft, review-draft, lesson-summary,
`prompts` CRUD, `system-prompts` list / `PUT` / `DELETE` by feature), `/api/admin/ai/**`
(status, usage, requests — metadata).

## Frontend

`features/ai/`: `homework-ai-panel.ts` (the editor's assistant bar over the text: request, «Промты» menu — search, «Сохранить запрос как промт», link to the library; «Опереться на» popover; draft with «Заменить» / «Вставить в конец» / «Отбросить», «Ещё раз»), `ai-settings-panel.ts` = the settings category «ИИ-помощник» (`/teacher/settings/ai`, `/teacher/ai` redirects; usage, the request log with «Показать ещё») with `prompt-library-card.ts` (`#prompt-library`, the menu's link) and
`system-prompts-card.ts` (both system prompts, «Изменён», a dialog with «Вернуть стандартный»); embedded via `parts.ts`.

The assignment editor uses a main authoring pane and an AI supporting pane (0.29.0 variant 1).
From expanded width the AI is on the right; compact/medium use a modal right drawer with focus return.
In the pane a switch «Что готовить» chooses «Задание» (the text draft) or «Вопросы» (0.39.0): the same request and
sources, the draft of questions with their type, points and key, «Добавить в конец» / «Заменить все»; disabled with a
hint once students started the quiz. `HomeworkAiState` is scoped to the editor so requests, source keys, draft and in-flight generation survive
closing or adapting the panel. Markdown preview remains a single Text/Preview field. Applying a draft
requires Insert/Replace; closing the AI never changes authored text. Materials/videos and submit order stay intact.
