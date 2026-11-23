# textbooks

The teacher's textbooks, workbooks and other materials: one file each, shared with any number of students and
groups; pages of a PDF cut out for homework and rendered as pictures for boards; courses (460.1);
lesson plans and their bank (461.1).
Depends on: `shared`, `identity::api`. Schema `textbooks`. ADR: [0033](../adr/0033-textbooks.md),
[0071](../adr/0071-courses-lesson-plans-and-bank.md).

## Rules

- Kinds: `TEXTBOOK` «Учебник», `WORKBOOK` «Рабочая тетрадь», `OTHER` «Другое». Title 1–200; the
  course — `courseId` of an existing course (404 `textbooks.course-not-found`), `null` — none.
- **Courses** (ADR-0071): a name 1–100 (`textbooks.course-invalid`), unique ignoring case (409
  `textbooks.course-exists`, `name_key = lower(name)`), a new one goes last (`position`); renamed
  with `version`. A student and a group have at most one current course (`student_courses`,
  `group_courses`): given only to a current student / an active group (404
  `textbooks.student-not-found` / `textbooks.group-not-found`), `null` always clears it. Deleting a
  course clears the textbooks' course (a new version each), the students' and groups' links and
  the `COURSE` members, then publishes `CourseDeleted`. Migration `V3`: the courses come from the
  distinct trimmed non-blank `textbooks.course` values ignoring case (the oldest textbook's
  spelling wins, positions by name), `course_id` filled, `course` dropped.
- **Lesson plans** (461.1, ADR-0071, the bank): title 1–200 (`textbooks.plan-title-invalid`),
  Markdown body ≤ 20 000 (`textbooks.plan-body-too-long`), an existing course or none, saved with
  `version`. Textbooks — the rules of homework's bound textbooks: an existing textbook (404
  `textbooks.textbook-not-found`), pages normalized by `PageRanges` (blank — the whole textbook),
  each once (`textbooks.plan-textbook-twice`), ≤ 20, in the teacher's order; a deleted textbook
  leaves its plans (cascade). Videos — the shape of homework's: ≤ 5, `video.*` errors,
  `transcriptShown` off unless set. A deleted course leaves its plans without one (a new version
  each). Two kinds of rows: a **bank item** (`bank`, an original, never on a lesson, no
  `source_id`) and a **working plan** (a plan of one lesson; `source_id` — the bank item it came
  from or was saved as). «Готово» (`finish`): a working plan without `source_id` saves its copy
  into the bank and takes it as `source_id`; any other plan is left as it is. `bank` of a working
  plan: no original (never saved or deleted) — a new one, else the original's content (title,
  body, course, textbooks, videos) is replaced; a bank item — 409 `textbooks.plan-in-bank`. `use`
  of a bank item makes a working copy with `source_id` (transcripts carried) and never adds to the
  bank; a working plan — 409 `textbooks.plan-not-in-bank`; the `lessonId` is only echoed — the
  link is `schedule`'s (461.2). Editing a bank item never changes its copies; deleting it keeps
  them (`source_id` → null). `uses` — the working plans with this `source_id`.
- One file per textbook (`TextbookFiles`): png, jpeg, webp, gif, PDF — by the first bytes; DOC (OLE) and DOCX
  (ZIP) — by the first bytes and the extension; nothing else (no SVG). Empty — `textbooks.file-empty`, over
  100 MB — `textbooks.file-too-large`. The content type served is the one found, never the client's. Stored
  in the `textbooks` namespace of `FileStorage`; replacing the file deletes the old one, deleting the textbook
  deletes its file.
- Format (`TextbookFormat`): `IMAGE` (one page), `PDF` (pages counted by PDFBox; a broken or
  password-protected PDF — `textbooks.pdf-unreadable`), `DOCUMENT` (pages — the teacher's number or none;
  no cut-outs, no pictures — `textbooks.not-paged`). A document keeps the teacher's number when its file is
  replaced by another document.
- Members: students and groups like boards — new ones must be current students and active groups
  (`textbooks.student-not-found`, `textbooks.group-not-found`); those the textbook has stay when they leave.
  «Ученики курса» (`COURSE`, ADR-0071) — the students whose current course it is and the members of
  current groups with that course, counted on every request; the course must exist.
- Access: the teacher — every textbook; a student — one they are a member of directly, through a
  current group or through the current course of either; anyone else — 404. `ADMIN` — none.
- Pages (`api.PageRanges`): the teacher writes `1-3, 7` (commas, spaces, `-` / `–` / `—`); kept normalized,
  ≤ 500 pages, page ≤ 10 000 (`textbooks.pages-invalid`); past the textbook's end — `textbooks.pages-beyond`.
- A page picture (`PdfPages.picture`): PNG at 150 dpi, at most 2000 px wide (a turned page counts its turned
  width); an image textbook's page 1 is the file itself.
- Cover (245.1): a PDF — its first page rendered by PDFBox at most 600 px wide (`PdfPages.cover`), kept as a PNG in the
  `textbooks` namespace (`textbooks.cover_key`, `V2`); made on upload and replacing the file (the old one is deleted
  with the textbook's old file) and, for a textbook uploaded before, on the first request. An image — the file
  itself. *A Word file has no cover (decision of 245.1: PDFBox is already in the project and renders PDF only;
  rendering DOC/DOCX needs LibreOffice or a commercial library, too heavy for a small self-hosted portal) — `hasCover`
  is false and the feed shows the format icon.*
- Downloads are always attachments with `nosniff`, `no-store`; page pictures are `private, max-age=300`.

## Contract (`textbooks::api`)

`Textbooks` facade (for `homework`): `find(id)`, `find(ids)` — `TextbookSummary` (kind, title,
`courseId`, `courseName`, format, pages), deleted ones skipped; `content(id, pages)` —
`TextbookContent`: a PDF cut to the pages (those past the end skipped, named `<file> (с. 1-3).pdf`),
any other file whole.

`Courses` facade (ADR-0071; `homework` checks `assignments.course_id`): `find(id)`, `find(ids)` →
`CourseSummary (id, name)`, deleted ones skipped; `ofStudent(id)`, `ofGroup(id)` — the current
course. Event `CourseDeleted(courseId)` — after the course and its own links are gone.

`LessonPlans` facade (ADR-0071; for `schedule` in 461.2): `find(ids)` → `LessonPlanView (id,
title, body, courseId, bank, textbooks [{id, title, kind, format, pages}], videos [{url, provider,
videoId, startSeconds, title, transcript, transcriptShown}])`, deleted plans and textbooks skipped,
every transcript included (the caller hides one unless `transcriptShown`); `checkLinkable(id)` —
404 `textbooks.plan-not-found`, a bank item — 409 `textbooks.plan-in-bank`.

Videos (moved from `homework` in 0.60.0, [ADR-0047](../adr/0047-video-links-and-transcripts.md)):
`VideoLink` — `parse(url)` → provider (`YOUTUBE`, `RUTUBE`, `VK`, `OTHER`), video ID, start; YouTube
(`watch`, `youtu.be`, `shorts`, `embed`, `live`, `t=`), Rutube (32-hex ID), VK Video
(`video-<oid>_<id>`, `video_ext.php`); any other http(s) link is `OTHER`; not http(s) —
`video.link-invalid`. `VideoTranscripts` over the port `VideoCaptions`: `youtubeTracks(url)` and
`youtube(url, track?)` — the suggested track when none is chosen (the author's in the spoken
language, else the recognized one, else the first); cues merged into ~30-second paragraphs `[m:ss]
text`, up to `MAX_TRANSCRIPT` (100 000 characters, then `truncated`). Errors (422):
`video.not-youtube`, `video.captions-none`, `video.captions-failed`. The adapter
`youtube/YoutubeCaptions` is the InnerTube player (client `ANDROID`), timed text decoded as UTF-8
unless the answer names a charset; the proxy is `TEACHERBOX_HOMEWORK_YOUTUBE_PROXY` (the name is
kept for existing `.env` files; read live, ADR-0056).

## Data

`textbooks` (kind, title, course_id, page_count, format, file_key, filename, content_type, size,
cover_key, version), `textbook_members` (`member_type` `STUDENT` / `GROUP` / `COURSE`, `member_id`),
`courses` (name, name_key, position, version), `student_courses`, `group_courses` (one current
course each, cascade with the course), `lesson_plans` (title, body, course_id, bank, source_id —
`on delete set null`, created_at, updated_at, version), `lesson_plan_textbooks` (plan_id,
textbook_id, position, pages), `lesson_plan_videos` (the columns of `assignment_videos`), `V4`. All
are in the full reset; files are in the portal backup.

## REST

| Endpoint | Who |
|---|---|
| `GET /api/teacher/textbooks` (newest first; `courseId`, `courseName`), `POST` (multipart: `file`, `kind`, `title`, `courseId`, `pageCount`, `studentIds`, `groupIds`, `courseIds`) | teacher |
| `GET /api/teacher/textbooks/courses` (in order), `POST {name}` (201), `PUT /courses/{id} {name, version}`, `PUT /courses/order {ids}` (every course once, else 422 `textbooks.course-order-invalid`; positions without a new version), `DELETE /courses/{id}` (204) | teacher |
| `PUT /api/teacher/textbooks/students/{studentId}/course`, `PUT …/groups/{groupId}/course` `{courseId \| null}` (204); `GET …/course-links` → `{students: [{studentId, courseId}], groups: [{groupId, courseId}]}` | teacher |
| `PUT /api/teacher/textbooks/{id}` (JSON with `version`, `courseId`, `courseIds`), `PUT /{id}/file` (multipart `file`, `version`), `DELETE /{id}` | teacher |
| `GET /api/teacher/textbooks/{id}/file`, `GET /{id}/pages/{n}` (picture), `GET /{id}/cover` | teacher |
| `GET /api/me/textbooks` (with `groupNames`, `courseName`, newest change first), `GET /api/me/textbooks/{id}/file`, `GET /api/me/textbooks/{id}/cover` (404 for a textbook of others and for a Word file) | student |
| `GET /api/teacher/textbooks/plans` (`?bank=true` — the bank with `uses`, else the working plans; last changed first), `POST {title, body, courseId, bank, textbooks: [{textbookId, pages}], videos}` (201), `GET/PUT/DELETE …/plans/{id}` (`PUT` — the whole content with `version`; `DELETE` 204), `POST …/{id}/finish` («Готово»), `POST …/{id}/bank` (save / update the original), `POST …/{id}/use {lessonId}` → 201 `{lessonId, plan}` | teacher |
| `POST /api/teacher/textbooks/videos/captions` `{url}` → `{title, tracks: [{language, automatic}], suggested}`; `POST …/videos/transcript` `{url, language?, automatic?}` → `{title, language, automatic, transcript, truncated}` (nothing is saved) | teacher |

Uploads up to 100 MB: Spring multipart limits and nginx `client_max_body_size` for `/api/teacher/textbooks`.

## Frontend

The material dialog uses the shared `identity/parts` member picker: one searchable field with typed
student/group chips. It persists individual and group grants separately; group membership stays dynamic.
Existing members absent from current options remain visible and removable.

`features/textbooks/` (pages in `index.ts`, types in `parts.ts`), labels in `textbooks-labels.ts`:

- `teacher/textbooks-feed.ts` — the textbooks tab of «Материалы» (`features/materials`, `/teacher/materials?tab=textbooks`, 245.2; `/teacher/textbooks` redirects; cards with covers, `TextbooksFeed` in `parts.ts`; the rest of this item is the behaviour of the former page): one row per textbook
  (`tb-list`) under a «Поиск по названию» field (case-insensitive, «Ничего не найдено» when nothing matches):
  kind icon, the title (a tap opens it — `shared/files/file-opener.ts`: a PDF or a picture in a new tab, a Word
  file saved), «Учебник · course · PDF, 120 с., 4,2 МБ», members; row
  menu «⋮» — «Скачать», «Изменить», «Заменить файл» (a hidden file input, opened within the menu click),
  «Удалить…» (`dangerConfirmation`). `textbook-dialog.ts` — the file (only when added; the title comes from the
  file name; over 100 MB refused before sending), kind, title, course (suggestions from the other textbooks),
  pages of a Word file, students, groups (members that left stay).
- `student/my-textbooks-page.ts` — «Учебники» (`/cabinet/textbooks`, after «Задания»; on a phone under ☰
  since 231.2): their textbooks with the group names and the same
  search; a tap on the title opens one, the download button saves it.
- `teacher/textbook-to-board-dialog.ts` (in `parts.ts`, also used by homework) — «На доску» (row menu, not for a
  Word file): the boards' `ToBoardDialog` in its pages mode with a projected «Страницы» field for a PDF of more
  than one page (`page-ranges.ts`: like `PageRanges`, at most 30 pages at once; the given pages — e.g. those
  bound to an assignment — or page 1 to start with); the frame is named «<title>, с. 2-4» (an image — the title).
