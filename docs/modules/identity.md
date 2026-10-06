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
  `StudentSummary.avatar` (0.9.2): billing (overview, debtors), meetings (call rooms), schedule (lessons and
  their participants) pass it to their views.
- **Groups** — name, members, archive; a student may be in several groups. Prices of groups live in `billing`,
  lessons in `schedule`.
- Implements `shared.security.PasswordConfirmation`.

## Contract (`identity::api`)

- Facades: `UserDirectory` (`teacherId`, `findStudent(s)`, `currentStudents`, `isCurrent`), `StudentGroups`
  (`findGroup(s)`, `groupsOf`). DTOs `StudentSummary`, `GroupSummary`, enum `StudentStatus`.
- Events: `StudentRegistered`, `StudentActivated`, `StudentDeactivated`, `StudentReactivated`, `GroupCreated`,
  `GroupChanged` (name/members, who joined/left), `GroupArchived`.
- Consumers: `billing` (accounts, group prices), `schedule` (group changes), `notifications`.

## Data

`users` (+ `own_name`, `avatar_key`, `avatar_type`), `invites`, `refresh_tokens`, `student_groups`,
`group_members`. Housekeeping job removes expired tokens/invites (`IdentityHousekeeping`). Photo files are removed
with the rest of the files by the full reset.

## REST

`/api/auth/**` (login, logout, refresh, invites), `/api/me` (+ `/password`, `/profile` — a student's own name,
`/avatar` PUT multipart / DELETE), `/api/public/avatars/{key}`, `/api/teacher/students/**`,
`/api/teacher/groups/**`, `/api/teacher/profile`.

## Frontend

`features/identity/`: `login/`, `invite/`, `students/` (list, form, invite link), `groups/` (panel on the
students page), `account/` («Мой аккаунт»: profile hero, password change; the teacher's name; the photo of the teacher or a student, a student's own name). Avatars —
`shared/ui/avatar.ts` (`tb-avatar`: photo or initials), photo preparation — `shared/files/square-photo.ts`. Auth state, guards and token refresh —
`core/auth/`.
