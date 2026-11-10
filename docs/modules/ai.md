# ai

LLM features for the teacher: homework draft, quiz questions draft, review draft and lesson summary draft. Depends on: `shared`,
`textbooks::api`,
`homework::api` — only to read the sources of a draft ([ADR-0039](../adr/0039-ai-reads-homework-sources.md)); other
texts come from the frontend. Schema `ai`. ADRs: [0006](../adr/0006-ai-integration.md),
[0009](../adr/0009-external-integrations.md). **Load the `claude-api` skill before changing LLM code.**

## Rules

- Providers and models ([ADR-0057](../adr/0057-several-ai-providers.md), since 364.1):
  `ai.providers` (kind, name 1–60, API key, base URL, proxy, position, version), `ai.models` (model id 1–120 unique
  per provider, label 1–60, effort, fallbacks, max tokens, timeout, position, version; removed with
  their provider) and `ai.settings` (one row: default model, monthly token limit; a removed default
  model becomes `null` — AI off). `LlmClients.forModel(id)` / `forDefault()` give a `ModelClient`
  (provider, model, `LlmClient`); clients are kept per provider and built anew when the provider's
  or the model's version or the proxy in force changes. A provider that cannot be called (no key, no
  address, a bad proxy) gets a client whose calls fail with the reason.
- Model per request (since 364.3): `homework-draft`, `quiz-draft` (JSON and multipart `brief`),
  `review-draft` and `lesson-summary` take an optional `modelId` (a configured model's id); none —
  the default model (none configured — 422 `ai.disabled`). An unknown or removed model is 409
  `ai.model.unknown` with `defaultModelId` and `defaultModel` (its label) when a default exists;
  nothing is sent to a provider and nothing is logged.
- Connections over REST (`application.AiProviders`, since 364.2): a new connection needs what its
  kind needs (a key — `ai.provider.key-required`; an OpenAI-compatible address —
  `ai.provider.address-required`; a usable proxy), its name defaults to the kind's. The key is
  write-only: views carry `keySet` and `keyEnding` (last 4 characters, only for keys of 12+);
  `PUT` keeps the key unless a new one or `removeKey` comes; the kind never changes. A check asks
  the provider for its models (`LlmClient.models()`, no tokens; a probe client from
  `LlmClients.probe`, kept nowhere and closed) when a connection is saved or on request; the last
  result (`UNCHECKED` / `OK` / `FAILED` + the provider's message) is kept in memory for the
  provider's version. A connection holding the default model is not deleted
  (`ai.provider.holds-default`, 409); a model id is unique in its connection (`ai.model.duplicate`);
  the first model added while there is no default one becomes the default.
- SPI `LlmAdapter` per `ProviderKind` builds the clients: `anthropic/` (official Java SDK,
  structured outputs, server-side fallbacks per model), `openai/` (OpenAI-compatible
  `/chat/completions` on `RestClient`, JSON Schema in `response_format`; the provider's base URL is
  required), `gemini/` (Gemini API key via the OpenAI-compatible endpoint; needs a proxy from
  Russia), `openrouter/` (the OpenAI-compatible client with `https://openrouter.ai/api/v1`, default
  model `openrouter/auto`, `provider.require_parameters: true` in the body so the JSON schema is
  never silently ignored, title header `X-OpenRouter-Title: Teacher Box` and no referer — it would
  publish the portal's address in OpenRouter's rankings), `deepseek/` (`https://api.deepseek.com`,
  default model `deepseek-flash`, answer format `JSON_OBJECT`). Defaults of each kind (model,
  address, whether a key is required) are in `ProviderKind`.
- Answer format (`OpenAiCompatibleLlmClient.AnswerFormat`): `JSON_SCHEMA` — `response_format: json_schema`;
  `JSON_OBJECT` — `response_format: json_object` and the schema appended to the system prompt (DeepSeek takes no
  schema). A `JSON_SCHEMA` client switches to `JSON_OBJECT` for good after a 400 that names `response_format`.
- Proxy: the provider's own, else the administrator's live default `TEACHERBOX_AI_PROXY`
  (`AiProperties`, read through `LiveProperties` per request; ADR-0056). No default model → module
  off, UI hides AI features.
- The `TEACHERBOX_AI_*` variables except the proxy are imported once by `AiSettingsImport`
  (`shared.settings.TeacherSettingsImport`): the provider (named after its kind) with one model —
  the given one or the kind's default, labelled by its id — as the default model, and the monthly
  limit. Nothing is imported while a provider exists; an incomplete configuration is left out.
- Responses are always drafts the teacher edits. Refusals handled before reading the answer; output validated
  against the schema (tolerant of Markdown wrapping).
- Monthly token limit (`ai.settings.monthly_token_limit`, default 2 000 000, `0` = unlimited;
  input + output for all models, instance time zone): over the limit requests are rejected before
  calling the provider.
- Usage per model (since 364.3): `UsageReport.models` — `ModelUsage {modelId, label, provider,
  removed, requests, inputTokens, outputTokens}` for the models with requests in the month: the
  configured ones in their order (label and provider kind of the connection), then removed ones
  (most tokens first, labelled by the model the provider answered with; `modelId: null` for requests
  logged before models had ids). The limit stays one for all the models.
- `ai.requests` stores metadata only (feature, provider kind, model, configured `model_id`,
  status, tokens, duration, error) — never texts.
- Request log by pages of 10 (since 0.14.6): `usage` returns the first page (`recent`, `moreRecent`), `GET requests`
  `?month&offset` the next ones (`RequestPage {items, hasMore}`), for the teacher and the administrator.
- Prompt library (`PromptLibrary`, `ai.prompts`): the teacher's saved prompts — title 1–100, text 1–4000 (no kinds
  since 0.14.1, ADR-0041); listed by title, optimistic locking, in the full reset; kept whether the AI is configured
  or not.
- Prompts are versioned module resources. `AiIntegrationCheck` (the administrator's diagnostics,
  `AiProviders.diagnose`, since 364.3) checks every connection without spending tokens, one line
  each:
  «ИИ (<provider>)», numbered («ИИ (anthropic, 2)») when several share a provider — no connection
  names. It pings the connection's default model, else its first one; a connection without models
  is asked for its list («Подключение отвечает, моделей в нём пока нет»). No connection — one
  `NOT_CONFIGURED` line. The diagnostics do not change the teacher's check state of a connection.
- System prompts (`SystemPrompts`, `ai.system_prompts`, [ADR-0043](../adr/0043-editable-system-prompts.md), since
  0.14.6): the teacher rewrites the system prompt of a feature (`HOMEWORK_DRAFT`, `QUIZ_DRAFT`, `REVIEW_DRAFT`, `LESSON_SUMMARY`; 1–10000 characters,
  `ai.system-prompt-invalid`); a feature without a row uses its resource (`homework-draft.system.v4`,
  `quiz-draft.system.v1`, `review-draft.system.v1`, `lesson-summary.system.v1`). The teacher's text goes to the model as is (no placeholders). Optimistic locking — the
  default prompt has version 0; in the UI (0.34.0) «Вернуть стандартный» is in the «⋮» of the edit dialog's header; `DELETE` returns to the default; in the full reset. The user prompts (`*.user.*`,
  with `<request>` / `<answer>`) stay resources.
- Homework draft (`POST homework-draft` `{prompt ≤ 4000, title?, sources?, context?}`, prompts
  `homework-draft.system.v4`, `homework-draft.user.v4`): always
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
  `sources`, prompts `quiz-draft.system.v1`, `quiz-draft.user.v2`, 0.39.0, [ADR-0052](../adr/0052-auto-checked-quizzes.md)): `{questions: [...]}`
  with the six types. `ai` does not know `homework` internals: every draft goes through the facade
  `homework::api.QuizDrafts`, which applies the same rules as saving (limits, ids, a correct option) and drops what
  fails; a draft with no valid question is an empty list. The answer is never saved: the editor shows it with the key
  and the teacher appends it to the questions or replaces them, then saves the assignment. The enum value
  `QUIZ_DRAFT` is allowed in `system_prompts` by migration `V3__quiz_draft_feature.sql`.
- Review draft (`POST review-draft` `{title ≤ 200, description ≤ 20000?, answer ≤ 20000, context?}` →
  `{comment, grade?, accept}`, prompts `review-draft.system.v1`, `review-draft.user.v2`): the answer goes between
  `<answer>` tags as data.
- Student context ([ADR-0055](../adr/0055-student-tags.md), stage 362): `context` — up to 10
  `{name ≤ 60, value ≤ 120}` (both non-blank; 400 beyond the limits) in `homework-draft`, `quiz-draft`
  (also in the `brief` part of `multipart/form-data`) and `review-draft`. The frontend collects the
  recipients' tags marked «Учитывать в ИИ» and joins several values of one tag as «7 · 8»; `ai` does
  not depend on `identity`. `AiAssistant` renders the pairs as `name: value` lines through
  `student-context.v1` into the `{{students}}` placeholder at the top of the user prompt: between
  `<students>` tags, as data, with the rule «defaults; the teacher's request wins». The rule lives in
  the user prompt, so a rewritten system prompt keeps it. No context — no block. `ai.requests` keeps
  no context.
- Lesson summary draft (`POST lesson-summary` `{topic ≤ 200?, words ≤ 2000?, assignmentTitles[≤ 20]?}` → `{summary}`,
  prompts `lesson-summary.*.v1`, since 0.37.0): a short Markdown «Что прошли» from the topic, the titles of the
  assignments given at the lesson and the teacher's words (between `<words>` tags, data only); at least the topic or the
  words must be non-blank. `ai` does not depend on `schedule`: the frontend sends the texts. The enum value
  `LESSON_SUMMARY` is allowed in `system_prompts` by migration `V2__lesson_summary_feature.sql`.
- Tests: Anthropic adapter against a local HTTP server (SDK uses OkHttp); OpenAI-compatible — `MockRestServiceServer`.
  Module tests run on `FakeProvider` (an OpenAI-compatible row whose adapter returns
  `FakeLlmClient`).

## Data, REST

`requests`, `prompts`, `system_prompts`, `providers`, `models`, `settings` (all in the full reset).
`/api/teacher/ai/**` (status, usage — with `models`, requests, homework-draft, quiz-draft,
review-draft, lesson-summary — each with an optional `modelId`, `prompts` CRUD, `system-prompts`
list / `PUT` / `DELETE` by feature, `providers` —
list, `POST /providers/check` (an unsaved connection: state and its models), `POST` (saved and
checked, 201), `PUT /{id}`, `POST /{id}/check`, `DELETE /{id}`; `/providers/{id}/models` — `POST`,
`PUT /{modelId}` (with `version`), `DELETE /{modelId}`, `PUT /order` (every model once), `GET
/available` (the provider's list with `added`; empty when it keeps none; 422
`ai.provider.unavailable`); `GET` / `PUT settings` — default model (`null` — AI off) and monthly
limit, versioned), `/api/admin/ai/**` (status, usage, requests — metadata; `providers` — kind,
`keySet`, check state, number of models; no keys, names, addresses or proxies).

## Frontend

`features/ai/`: `homework-ai-panel.ts` (the editor's assistant bar over the text: request, «Промты»
menu — search, «Сохранить запрос как промт», link to the library; «Опереться на» popover; draft with
«Заменить» / «Вставить в конец» / «Отбросить», «Ещё раз»), `ai-settings-panel.ts` = the settings
category «ИИ-помощник» (`/teacher/settings/ai`, `/teacher/ai` redirects; usage split by model with
the monthly limit, the request log with «Показать ещё»; `ai-setup.ts` holds the connections and
`/settings` the cards share, `ai-connections-card.ts` — connections with nested models and the
default radio, `ai-provider-dialog.ts` — the two-step connection dialog, `ai-model-dialog.ts` — a
model's change; 364.4) with `prompt-library-card.ts` (`#prompt-library`, the menu's link) and
`system-prompts-card.ts` (both system prompts, «Изменён», a dialog with «Вернуть стандартный»); embedded via `parts.ts`.

The assignment editor uses a main authoring pane and an AI supporting pane (0.29.0 variant 1).
From expanded width the AI is on the right; compact/medium use a modal right drawer with focus return.
In the pane a switch «Что готовить» chooses «Задание» (the text draft) or «Вопросы» (0.39.0): the same request and
sources, the draft of questions with their type, points and key, «Добавить в конец» / «Заменить все»; disabled with a
hint once students started the quiz. `HomeworkAiState` is scoped to the editor so requests, source keys, draft and in-flight generation survive
closing or adapting the panel. Markdown preview remains a single Text/Preview field. Applying a draft
requires Insert/Replace; closing the AI never changes authored text. Materials/videos and submit order stay intact.
