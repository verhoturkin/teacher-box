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

## v0.19.0

Video by link in homework (YouTube, Rutube, VK Video, any other link): a «Видео» section of the assignment editor
with the player, the title and a transcript; «Взять субтитры с YouTube» fills the transcript from the video's
captions on the server; .srt / .vtt files load it too. The AI assistant reads the transcripts — the only way a
text-only provider (DeepSeek) knows what the video says. No video files: links only.
ADR: [0047](adr/0047-video-links-and-transcripts.md).

### 218. Video links in assignments (B)

- [x] 218.1 **B** `homework.assignment_videos` (`V2__assignment_videos.sql`; reset), `domain/VideoLink.parse`
  (provider, video ID, start), `domain/AssignmentVideo`; `videos` in the create / update requests (replace all,
  at most 5), `AssignmentDetails.videos`, the student's `AssignmentInfo.videos` (the transcript only when shown);
  CSP `frame-src` for the players (backend and nginx).

### 219. YouTube captions (B)

- [x] 219.1 **B** `homework/youtube/YoutubeCaptions` (InnerTube player → caption track → timed text, merged into
  `[m:ss]` paragraphs), `POST /api/teacher/homework/videos/transcript {url}`, `TEACHERBOX_HOMEWORK_YOUTUBE_PROXY`.

### 220. The AI reads video transcripts (B)

- [x] 220.1 **B** Source `{type: VIDEO, title, url, transcript}` of a homework draft (`DraftSources.VideoTranscript`,
  `LlmSource` `text/plain`: Anthropic — a text document, OpenAI-compatible — a text part); `homework-draft.system.v4`.

### 221. The «Видео» section (F)

- [x] 221.1 **F** `homework/ui/video-player.ts` (embed by provider, a link otherwise), `ui/video-links.ts`,
  `teacher/video-section.ts` in the editor (link, title, transcript: «Взять субтитры с YouTube», «Загрузить
  субтитры», «Показывать ученику»; «Добавить видео»), the assignment and task pages; the videos with a transcript
  in «Опереться на»; help articles, wiki `Features`, `AI-assistant`, `Proxy`.

### 222. Release 0.19.0 (D)

- [ ] 222.1 **D** E2E spec, CHANGELOG, version 0.19.0, plan archive.

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
