# homework

Assignments, submissions, review, attachments, bound textbooks. Depends on: `shared`, `identity::api`,
`textbooks::api`. Schema `homework`.

## Rules

- An **assignment** is given to one or more students; each student gets a **task** with status
  `ASSIGNED → SUBMITTED → RETURNED («На доработке») / ACCEPTED («Принято»)`; a returned task can be
  re-submitted. A **submission** is one attempt (UI: «ответ»), the whole handed-in work is «работа».
- No kinds since 0.14.1 ([ADR-0041](../adr/0041-homework-without-kinds-board-link.md), supersedes ADR-0040): every
  assignment is a Markdown text with textbooks and files, answered with a text and / or files
  (`POST /api/me/homework/tasks/{id}/submissions`). Migration `V5` dropped `kind`, `interactive_html` and the results
  of interactive pages.
- **The board of an assignment** (ADR-0041): `assignments.board_id` — the board it was put on (a UUID only,
  `homework` does not know `boards`); `PUT /api/teacher/homework/assignments/{id}/board {boardId}` (`null` forgets it)
  changes no version. `boardId` is in `AssignmentDetails`, `AssignmentSummary` and the student's `AssignmentInfo`.
- **Videos by link** ([ADR-0047](../adr/0047-video-links-and-transcripts.md), 0.19.0): up to 5 per assignment
  (`homework.assignment_videos`, cascade with the assignment), sent as `videos [{url, title?, transcript?,
  transcriptShown}]` in the create / update requests — the list replaces the old one, an update without it keeps them.
  `VideoLink.parse`: YouTube (`watch`, `youtu.be`, `shorts`, `embed`, `live`, `t=` → `startSeconds`), Rutube
  (32-hex ID), VK Video (`video-<oid>_<id>`, `video_ext.php`); any other http(s) link is `OTHER` (a link, no
  player); not http(s) — `video.link-invalid`, over 5 — `video.too-many`. Transcript — lines `[m:ss] text`, up to
  100 000 characters; `AssignmentDetails.videos` has every transcript, the student's `AssignmentInfo.videos` only
  those with `transcriptShown`. «Взять субтитры с YouTube» (saves nothing): `POST /api/teacher/homework/videos/captions
  {url}` → `{title, tracks: [{language, automatic}], suggested}` (0.19.1), then `POST …/videos/transcript {url,
  language?, automatic}` — the chosen track, without `language` the suggested one. `VideoTranscripts` over the port
  `VideoCaptions`, adapter `youtube/YoutubeCaptions` — the InnerTube player (client `ANDROID`); suggested: the author's
  track in the spoken language, else the recognized one, else the first; timed text decoded as UTF-8 unless the answer
  names a charset; cues merged into ~30-second paragraphs; `{title, language, automatic, transcript, truncated}`; a
  track the video does not have — `video.captions-none`; errors
  `video.not-youtube`, `video.captions-none`, `video.captions-failed` (422). Proxy
  `TEACHERBOX_HOMEWORK_YOUTUBE_PROXY`. CSP `frame-src`: `youtube-nocookie.com`, `rutube.ru`, `vkvideo.ru`.
- Due date; `DueSoonReminder` publishes `HomeworkDueSoon` once per unfinished task within
  `TEACHERBOX_HOMEWORK_DUE_SOON_WINDOW`.
- Attachments of assignments and submissions — `FileStorage` namespace `homework`, limits
  `TEACHERBOX_HOMEWORK_MAX_FILE_SIZE`, `MAX_FILES_PER_UPLOAD` (`FilePolicy`).
- Review queue for the teacher; AI drafts are produced by the `ai` module from texts the frontend passes — `homework`
  does not know `ai`.
- Textbooks ([ADR-0033](../adr/0033-textbooks.md)): the teacher binds a textbook to an assignment with pages
  (`1-3, 7`, checked against its page count by `textbooks::api.PageRanges`) or whole (blank); binding it again
  changes the pages. `AssignmentDetails.textbooks` / `AssignmentInfo.textbooks` (`BoundTextbookView`: kind,
  title, course, format, page count, pages) skip deleted textbooks. The student of the task downloads the bound
  pages: a PDF cut to them (`Textbooks.content`), any other file or a whole binding — the whole file
  (`Textbooks.file`); a textbook not bound to the task — 404 `homework.textbook-not-found`.
- **Deleting** (0.14.2): `DELETE /api/teacher/homework/assignments/{id}` (`AssignmentService.delete`) removes the files of
  the assignment and of its answers (`FileStorage`), the answers, the tasks and the assignment; bound textbooks go by
  cascade. No event: notifications already sent stay in the inbox, their link leads to «not found».
- **Copy** (0.36.0): `POST /api/teacher/homework/assignments/{id}/copy` (`AssignmentService.copy`, 201) — a new
  draft «<title> (копия)» (the title is cut to 200 characters) with the text, the files (new `FileStorage` keys, so
  deleting the original keeps the copy's files), the bound textbooks with pages and the videos with transcripts; no
  students, no deadline, no board.
- A student sees only own tasks and attachments (403/404 tests).

## Contract (`homework::api`)

Events: `HomeworkAssigned`, `HomeworkSubmitted`, `HomeworkReviewed`, `HomeworkDueSoon` → `notifications`.

`AssignmentFiles.file(assignmentId, attachmentId)` (for `ai`, [ADR-0039](../adr/0039-ai-reads-homework-sources.md)): a
file of the assignment's materials — name, type, size, content; another assignment's file — 404 `file.not-found`.

## Data

`assignments`, `tasks`, `submissions`, `attachments`, `assignment_textbooks` (assignment, textbook, pages),
`assignment_videos` (position, url, provider, video ID, start, title, transcript, shown).

Quizzes ([ADR-0052](../adr/0052-auto-checked-quizzes.md), `domain/quiz/`): `assignment_questions` (position, type,
text, `options` and `answer` as JSON by type, points, explanation), `quiz_attempts` (task, start, submit, score),
`quiz_answers` (attempt, question, answer, verdict, points, overridden); `assignments.quiz_reveal`
(`AFTER_SUBMIT` / `AFTER_DUE` / `NEVER`) and `quiz_attempts` (null = unlimited). Six question types, sealed
`Question` with a pure `check(Answer)`; limits: 50 questions, 2–10 options / pairs / items, 1–100 points.
Teacher REST (0.39.0): assignment create / update take `questions [{id?, type, text, points?,
explanation?, options, correct, accepted, value, tolerance, pairs}]` (update without `questions`
keeps them; a list replaces them, copy makes new ids), `quizReveal` and `quizAttempts` (0 =
unlimited, absent = keep / default 1); the details return the same with the key. Errors
`homework.quiz-*` (422); the list is frozen once any student started an attempt
(`homework.quiz-started`; the same list, text and settings stay editable).

## REST

`/api/teacher/homework/**` (assignments — the list has the names of the students of each, `DELETE assignments/{id}`, `POST assignments/{id}/copy`, students, attachments,
`PUT assignments/{id}/board`, `POST assignments/{id}/textbooks` `{textbookId, pages}`,
`DELETE assignments/{id}/textbooks/{textbookId}`, `POST videos/transcript`, tasks/{id}/review, review-queue, summary (besides the review counters it has `weekAssigned` — assignments given to current students and
`weekOnTime` — works handed in not later than the due date, both in the current Monday–Sunday week of the instance time
zone, for the Today page, 239.1),
`GET students/{studentId}/tasks` — the student's tasks as the student's list shows them, for the student card
(237.1); an unknown student has none);
`/api/me/homework/**` (tasks, submissions, attachments, `tasks/{taskId}/textbooks/{textbookId}`, summary, `limits`).

## Frontend

`features/homework/`: `teacher/` (assignments list pane, assignment page, editor), `student/` (my tasks, task
page), `ui/`, `home/` widgets, `homework-labels.ts`. Textbooks: `ui/textbook-list.ts` (kind icon, title,
«Учебник · course · с. 12-14» / «целиком»; the teacher's pencil and cross, the student's tap opens the pages in a new tab,
the download button saves them under `boundTextbookFilename`; 0.14.5: the teacher's tap on the title opens the whole
textbook, a PDF at its first bound page — `teacher/material-opener.ts`), `teacher/bind-textbook-dialog.ts` («Привязать учебник»: a textbook not bound yet from
`@features/textbooks/parts`, pages — none for an image; the pencil changes the pages of a bound one). Editor (`teacher/assignment-editor-page.ts`, routes `/teacher/homework/new` and `/teacher/homework/:id/edit`,
`canLeaveGuard`; «Создать › Задание» in the rail and, on a phone, «Новое задание» lead there): one Markdown field with a «Текст / Просмотр»
switch; students and groups (`tb-member-picker`: typed explicit selections resolve to a deduplicated snapshot of current available students; removing a group preserves explicit individual choices),
the due date — the start of the earliest scheduled lesson of the chosen students within 60 days
(`teacher/next-lesson.ts` over `ScheduleApi.lessons`) until the teacher sets it; textbooks and files only for a new
assignment (0.14.2: a saved one changes them on its page); picked files — `ui/file-picker.ts`, the same `tb-list` cards
as the saved ones, the name of a PDF or a picture opens it in a tab (0.14.5)
(`BindTextbookDialog` without an assignment emits `picked`, checked by `parsePages`). A new assignment is created
without students, gets its files and textbooks, then is given out — the notification goes with the materials in place;
a material that fails leaves the assignment saved with an error toast. Header: «Выдать» / «Сохранить» (filled) and
«Выдать и поместить на доску» / «Сохранить и поместить на доску» (tonal): it saves, then opens «На доску» for the
saved assignment (`ToBoardDialog [frame] [pictures]` from `teacher/assignment-board.ts`, the boards of its students);
`placed` → `PUT …/board`, closing the dialog leads to the assignment page. The assignment page: «На доску» (enabled
with a text, a picture file or a textbook page) also remembers the board, «Открыть доску» (`pi-arrow-up-right`) when
there is one, «Удалить…» (danger confirmation); materials — `ui/attachment-list.ts`, a `tb-list` like the textbooks
(type icon, name, size, the same red «×»; `openable` — the name opens the file through `MaterialOpener`, a PDF or a
picture in a tab, with a download button beside it — on the assignment and review pages); «Ученики» — a `tb-list` (avatar, name link to the task, «Сдано … / Не сдано»,
status), «Добавить» at the top right of the card opens `teacher/assign-more-dialog.ts` («Выдать ещё ученикам»: students
and groups in one searchable picker). The list (`teacher/assignments-page.ts`, 242.1) — the list pane of a list-detail (`tb-panes`, fixed pane; the detail pane is
`task-review-page.ts` or `assignment-page.ts`, see below): the connected group «На проверку · Активные · Готовые» with counts (`@shared/ui/segment-group`), the
filter button of the header opens one search by the title or a student's name. «На проверку» (the default while there is
work to review, else «Активные») — the works of `review-queue` (avatar, student, «задание · сдано dd.MM HH:mm», the
«Просрочено» tag when handed in after the due date), then «Ждут сдачи» — assignments somebody still has to hand in
(«N из M», or «Просрочено»); «Активные» — assignments given and not every task accepted, then «Не выдано» (drafts);
«Готовые» — `isDone`. A row of an assignment: title, «кому · до …», the progress badge, «⋮» (open, edit, «Проверить
работы» — switches to «На проверку», open the board, «Удалить…»). `/teacher/homework/review` redirects to the list.
Detail (242.2): `/teacher/homework`, `/teacher/homework/tasks/:taskId` and `/teacher/homework/:assignmentId` are one route
(`homeworkMatcher` in `app.routes.ts`, as the students'): the list stays and the work or the assignment opens in the
second pane (the row is `tb-list__item--current`, `aria-current`); on compact and medium the route shows one of them and
«back» (`single` input) leads to the list. The pages (`task-review-page.ts`, `assignment-page.ts`) reload when the id
changes and emit `changed` (reviewed, given to more students, deleted), so the list reads itself again. The work: title =
the assignment, the line «student · срок · status · попытка N», «Открыть на доске» (the assignment's board), the collapsible
«Задание» block (statement and files), «Ответ ученика», then «Проверка» (the form below extra-large; from extra-large it is the side sheet, see below; on a phone (< 600) the M3 floating toolbar — AI, comment, «На доработку», «Принять» — with the comment, the draft, the quick phrases and the grade in a bottom sheet, and the bottom navigation bar hidden: `RailState.bottomBarHidden`, `ReviewSheet [compact]`); blocks lie
on the pane's surface under uppercase labels, no cards. The student's «Задания» (0.15.1: `student/my-task-list.ts` — «Активные» / «Выполненные»
with a search by the title and pages of 10, as the teacher's) are `tb-list` cards too
(avatar, student, «задание · сдано · срок»; icon, title, «до …», status). The student's `my-task-page.ts` shows
«Перейти на доску» (`MyBoardButton` from `@features/boards/parts`) when the assignment has a board of theirs. «На доску»
of an assignment (`teacher/assignment-board.ts`): the frame «<title> · dd.MM.yyyy», the pictures — png / jpeg / webp /
gif files, then the bound pages of each textbook (a whole PDF — from page 1, an image — its picture, a document —
none), at most 30. Routes `/teacher/homework/**`, `/cabinet/homework/**`.

Videos (0.19.0, ADR-0047): the editor's «Видео» card (`teacher/video-section.ts`, new and saved assignments alike —
sent whole with `videos`): per video the link (checked by `ui/video-links.ts` `parseVideoLink`, the player under it),
«Название», «Расшифровка» with «Взять субтитры с YouTube» (YouTube links; several caption tracks — 0.19.1
`teacher/caption-language-dialog.ts` «Субтитры на каком языке взять?»: a radio list, the language by `Intl.DisplayNames`
in the interface language, «От автора видео» / «Автоматические — распознал YouTube», the suggested track first and checked,
«Взять», or «Заменить» with «Текущая расшифровка будет заменена.» when a transcript is written; a single track is taken
at once, asking before replacing a transcript; the result — «Субтитры YouTube: английский, автоматические» — or the
error under it) and «Загрузить субтитры» (.srt / .vtt → `subtitlesToTranscript`, `[m:ss]` paragraphs of
~30 s), «Показывать расшифровку ученику», a red «×»; «Добавить видео» up to 5; changes count for `canLeave`. Videos
with a transcript are «Видео: <name>» in «Опереться на». `ui/video-player.ts` — a 16:9 `iframe` (`embedUrl`:
`youtube-nocookie.com/embed`, `rutube.ru/play/embed`, `vkvideo.ru/video_ext.php`, built only from checked IDs), a link
card «Открыть видео в новой вкладке» otherwise; `ui/video-list.ts` on the assignment and task pages (the title, the
player, a «Расшифровка» toggle; the teacher's «ученик видит расшифровку»).

The assignment editor uses a main authoring pane and an AI supporting pane (0.29.0 variant 1).
From expanded width the AI is on the right and shares the width equally with the authoring pane (0.30.0);
compact/medium use a modal right drawer with focus return. Recipient and deadline controls align at their
top edges, including when title validation adds supporting error text.
`HomeworkAiState` is scoped to the editor so requests, source keys, draft and in-flight generation survive
closing or adapting the panel. Markdown preview remains a single Text/Preview field. Applying a draft
requires Insert/Replace; closing the AI never changes authored text. Materials/videos and submit order stay intact.
