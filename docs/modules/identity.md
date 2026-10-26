# identity

Auth of the teacher, students and admin; student groups. Depends on: `shared`. Schema `identity`.
ADRs: [0003](../adr/0003-authentication.md) auth, [0010](../adr/0010-administrator-and-diagnostics.md) admin,
[0011](../adr/0011-groups-and-group-lessons.md) groups.

## Rules

- **Teacher** — exactly one, created on first start from `TEACHERBOX_IDENTITY_TEACHER_*`; an auto-generated
  password must be changed at first login. **Admin** — exists only while `TEACHERBOX_IDENTITY_ADMIN_PASSWORD` is
  set; not created if the login is taken by a student; sees no student data.
- **Student** — created by the teacher (`INVITED`), gets a one-time invite link (TTL
  `TEACHERBOX_IDENTITY_INVITE_TTL`), sets login and password → `ACTIVE`. Deactivation revokes all refresh tokens
  and removes the student from all groups; reactivation restores access.
- Passwords — `DelegatingPasswordEncoder` (bcrypt), min length 8. Access token — JWT HS256, 15 min. Refresh token —
  random, only its hash stored, HttpOnly cookie, rotated on use. Brute force — per-account lock after
  `MAX_FAILED_LOGINS` for `LOCK_DURATION`, plus auth rate limit (`TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_*`).
- **Own name and photo (0.9.1)** — a student may set `own_name` (shown to the student: `/api/me`, the session
  user) and a photo (PNG/JPEG/WebP ≤ 1 MB, by magic bytes; the browser crops it to a 256 px square JPEG). The
  teacher keeps seeing the profile name (`StudentView.displayName`, facades, JWT `name`); the photo is shown to
  both. Files live in the `identity` namespace; a photo is served at `/api/public/avatars/{storage key}` — the
  key is the secret part of the link, a new photo gets a new key (immutable cache); the old file is deleted.
  Since 0.9.2 the teacher has a photo too (shown in the top bar and «Мой аккаунт»); the administrator has
  none (`account.no-photo`; `/api/me/avatar` is closed to the administrator). Other modules get the photo's address as
  `StudentSummary.avatar` (0.9.2): billing (overview, debtors, the monthly report's journal), meetings (call
  rooms), schedule (lessons and their participants, requests), homework (an assignment's tasks, the review
  queue) and notifications (the students' messengers) pass it to their views (all lists since 0.11.0).
- **Groups** — name, members, archive; a student may be in several groups. Prices of groups live in `billing`,
  lessons in `schedule`.
- **Default topic (0.13.0)** — a student (`users.default_topic`) and a group (`student_groups.default_topic`) may
  have a topic up to 500 characters, returned in `StudentView` / `GroupView`; the teacher's lesson and series
  dialogs fill it in for a new lesson (`schedule` itself stores only the lesson's own topic). Changing it
  publishes no event.
- **Colour (0.20.0)** — a student (`users.color`) and a group (`student_groups.color`) may have a colour of the
  palette `domain.LabelColor` (`RED`, `ORANGE`, `YELLOW`, `LIME`, `GREEN`, `CYAN`, `BLUE`, `VIOLET`, `PURPLE`,
  `PINK`; null — none), set in the create / update requests and returned in `StudentView` / `GroupView`. Only the
  teacher's interface paints it (the frontend looks it up by id — other modules' DTOs don't carry it); changing it
  publishes no event.
- **Language (0.11.1, ADR-0036)** — `users.language` (`ru` by default): the language of the interface the
  browser saves to the account (`PUT /api/me/language`, also open to the administrator); returned in `/api/me`
  and the session user. Other modules write notifications, bot messages and calendars in it
  (`UserDirectory.language`).
- Implements `shared.security.PasswordConfirmation`.

## Contract (`identity::api`)

- Facades: `UserDirectory` (`teacherId`, `findStudent(s)`, `currentStudents`, `isCurrent`, `language`), `StudentGroups`
  (`findGroup(s)`, `groupsOf`). DTOs `StudentSummary`, `GroupSummary`, enum `StudentStatus`.
- Events: `StudentRegistered`, `StudentActivated`, `StudentDeactivated`, `StudentReactivated`, `GroupCreated`,
  `GroupChanged` (name/members, who joined/left), `GroupArchived`.
- Consumers: `billing` (accounts, group prices), `schedule` (group changes), `notifications`.

## Data

`users` (+ `own_name`, `avatar_key`, `avatar_type`, `language`, `color`), `invites`, `refresh_tokens`, `student_groups`,
`group_members`. Housekeeping job removes expired tokens/invites (`IdentityHousekeeping`). Photo files are removed
with the rest of the files by the full reset.

## REST

`/api/auth/**` (login, logout, refresh, invites), `/api/me` (+ `/password`, `/language`, `/profile` — a student's own name,
`/avatar` PUT multipart / DELETE), `/api/public/avatars/{key}`, `/api/teacher/students/**`,
`/api/teacher/groups/**`, `/api/teacher/profile`.

## Frontend

The shared `groups/member-picker.ts` foundation (0.29.0, exported through `parts.ts`) provides one
searchable Students/Groups dropdown. Its reactive-form value is an array of typed `MemberSelection`
entries (`kind: STUDENT | GROUP`, `id`), deduplicated by type and ID. Options accept a name, optional
disambiguating detail and an unavailable flag; unavailable options are disabled, while missing prefilled
values remain visible by ID and removable. A selection limit supports single-recipient callers as well
as multiple selection. Disabled, touched, reset and validation behavior follows Angular forms and the
portal field convention. It performs no HTTP requests and never expands group membership: callers own
access grants or recipient snapshots, including preserving explicit students when removing groups.
Existing paired selectors are migrated in plan steps 258.2–258.3.

`features/identity/`: `login/`, `invite/`, `colors/` (0.20.0: `TeacherColors` — the colours of students and groups
by id, loaded by the teacher area's guard in `app.routes.ts`, used by every teacher list; since 0.27.0 accents are on avatars and group icons, with a ring around photos, while row backgrounds retain portal surface roles; `tbChipColors` — paints the
chips of a student / group multiselect; `tb-label-color-field` — the colour select of both dialogs),
`students/` (0.23.0, list-detail: `students-page.ts` — students and groups in one list pane on `tb-panes` with the chips
All · Groups · Debtors · No messenger · Disabled (`roster.ts`; balances from billing's overview, messengers from the
notifications list read), routes `/teacher/students/:id` and `/teacher/groups/:id`; `student-card.ts` — header
(`card-head.ts`, shared with the group) and tabs named by `?tab=` (`card-tabs.ts`): Overview, Lessons, Homework, Payments,
Profile — each tab is a part of its feature (`@features/<name>/parts`), the Profile tab (`student-profile-tab.ts`) edits the
profile in place, with disable/reactivate access beside password change; the student's header has no overflow
menu. `student-form-dialog.ts` only creates (name + contact) and opens the card; its text fields and the
Profile tab's text fields are standard `.tb-field` filled fields (design system §10); invite link),
`groups/` (`group-card.ts` — Overview, Lessons, Homework, Members, Profile; `group-form-dialog.ts` only creates;
`group-picker.ts` — `tb-group-picker`, a multiselect of groups next to a students multiselect: a chosen
group emits its current students (`picked`), a group taken off emits those in no other chosen group (`dropped`), the
host adds / removes them; `selected` is a model the host clears), `account/` («Мой аккаунт»: profile hero, password change; the teacher's name; the photo of the teacher or a student, a student's own name). Avatars —
`shared/ui/avatar.ts` (`tb-avatar`: photo or initials), photo preparation — `shared/files/square-photo.ts`. Auth state, guards and token refresh —
`core/auth/`.
