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

`users`, `invites`, `refresh_tokens`, `student_groups`, `group_members`. Housekeeping job removes expired
tokens/invites (`IdentityHousekeeping`).

## REST

`/api/auth/**` (login, logout, refresh, invites), `/api/me` (+ `/password`), `/api/teacher/students/**`,
`/api/teacher/groups/**`, `/api/teacher/profile`.

## Frontend

`features/identity/`: `login/`, `invite/`, `students/` (list, form, invite link), `groups/` (panel on the
students page), `account/` («Мой аккаунт», password change). Auth state, guards and token refresh —
`core/auth/`.
