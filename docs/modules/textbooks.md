# textbooks

The teacher's textbooks, workbooks and other materials: one file each, shared with any number of students and
groups; pages of a PDF cut out for homework and rendered as pictures for boards. Depends on: `shared`,
`identity::api`. Schema `textbooks`. ADR: [0033](../adr/0033-textbooks.md).

## Rules

- Kinds: `TEXTBOOK` «Учебник», `WORKBOOK` «Рабочая тетрадь», `OTHER` «Другое». Title 1–200, course (free text)
  ≤ 100, blank — none.
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
- Access: the teacher — every textbook; a student — one they are a member of directly or through a current
  group; anyone else — 404. `ADMIN` — none.
- Pages (`api.PageRanges`): the teacher writes `1-3, 7` (commas, spaces, `-` / `–` / `—`); kept normalized,
  ≤ 500 pages, page ≤ 10 000 (`textbooks.pages-invalid`); past the textbook's end — `textbooks.pages-beyond`.
- A page picture (`PdfPages.picture`): PNG at 150 dpi, at most 2000 px wide (a turned page counts its turned
  width); an image textbook's page 1 is the file itself.
- Downloads are always attachments with `nosniff`, `no-store`; page pictures are `private, max-age=300`.

## Contract (`textbooks::api`)

`Textbooks` facade (for `homework`): `find(id)`, `find(ids)` — `TextbookSummary` (kind, title, course, format,
pages), deleted ones skipped; `content(id, pages)` — `TextbookContent`: a PDF cut to the pages (those past the end
skipped, named `<file> (с. 1-3).pdf`), any other file whole. No events.

## Data

`textbooks` (kind, title, course, page_count, format, file_key, filename, content_type, size, version),
`textbook_members` (`member_type` `STUDENT` / `GROUP`, `member_id`). Both are in the full reset; files are in
the portal backup.

## REST

| Endpoint | Who |
|---|---|
| `GET /api/teacher/textbooks` (newest first), `POST` (multipart: `file`, `kind`, `title`, `course`, `pageCount`, `studentIds`, `groupIds`) | teacher |
| `PUT /api/teacher/textbooks/{id}` (JSON with `version`), `PUT /{id}/file` (multipart `file`, `version`), `DELETE /{id}` | teacher |
| `GET /api/teacher/textbooks/{id}/file`, `GET /{id}/pages/{n}` (picture) | teacher |
| `GET /api/me/textbooks` (with `groupNames`, newest change first), `GET /api/me/textbooks/{id}/file` | student |

Uploads up to 100 MB: Spring multipart limits and nginx `client_max_body_size` for `/api/teacher/textbooks`.

## Frontend

`features/textbooks/` (pages in `index.ts`, types in `parts.ts`), labels in `textbooks-labels.ts`:

- `teacher/textbooks-page.ts` — «Учебники» (`/teacher/textbooks`, menu item after «Задания»): one row per textbook
  (`tb-list`): kind icon, the title (a tap downloads), «Учебник · course · PDF, 120 с., 4,2 МБ», members; row
  menu «⋮» — «Скачать», «Изменить», «Заменить файл» (a hidden file input, opened within the menu click),
  «Удалить…» (`dangerConfirmation`). `textbook-dialog.ts` — the file (only when added; the title comes from the
  file name; over 100 MB refused before sending), kind, title, course (suggestions from the other textbooks),
  pages of a Word file, students, groups (members that left stay).
- `student/my-textbooks-page.ts` — «Учебники» (`/cabinet/textbooks`, after «Задания»; the student's sixth
  section, so «Оплаты» and «Мои доски» go under «Ещё» on a phone): their textbooks with the group names, a tap
  downloads.
