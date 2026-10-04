# ai

LLM features for the teacher: homework draft and review draft. Depends on: `shared` **only** — it never reads
homework data; the frontend sends the texts. Schema `ai`. ADRs: [0006](../adr/0006-ai-integration.md),
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
- Prompts are versioned module resources. `AiIntegrationCheck` checks the provider without spending tokens.
- Tests: Anthropic adapter against a local HTTP server (SDK uses OkHttp); OpenAI-compatible — `MockRestServiceServer`.

## Data, REST

`requests`. `/api/teacher/ai/**` (status, usage, homework-draft, review-draft), `/api/admin/ai/**` (status,
usage metadata).

## Frontend

`features/ai/`: homework draft dialog, AI usage page (`/teacher/ai`); embedded via `parts.ts`.
