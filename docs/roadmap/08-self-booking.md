# 08. Self-booking of free slots

Status: proposal. Size: L. ADR: yes — «Запись на свободное время», amends ADR-0008 (schedule).

## Goal

The teacher publishes when they are open for lessons («пн–пт 15:00–20:00, слоты по 60 минут»).
A student picks a free slot to move a lesson or to book an extra one, instead of guessing a time
and waiting for «Отклонить». Optionally a new person books a trial lesson by a public link
(phase 2). Today the student sees the teacher's busy time (`TeacherAvailability`, `/api/me/
schedule/busy`) and proposes a time in `change_requests`; there are no «open» windows.

## Decisions for the teacher

1. Approval: every booking is a request the teacher approves (proposed), or auto-confirm inside
   the windows?
2. Slot length and step: per window, or always the student's lesson duration? Buffer between
   lessons (e.g. 15 min)? Minimum notice (e.g. not earlier than 12 h from now)? Booking horizon
   (e.g. 3 weeks)?
3. Extra lessons: may every student book them, or only students the teacher allows («может
   записываться сам»)? Limit per week?
4. Phase 2 — public trial booking by link with name + contact, creating an `INVITED` student on
   approval: wanted?

## Design

- `schedule` data: `booking_windows (id, weekday, start_local, end_local, valid_from, valid_until,
  slot_minutes null, created_at)` in `TEACHERBOX_TIMEZONE` (same rule as repeat rules — DST does
  not shift them); `booking_settings` (one row: approval mode, buffer, notice, horizon, slot step);
  `students_booking (student_id, allowed, weekly_limit)`.
- Free slots = windows − (lessons + Google busy + off-times) − buffer, computed on the fly by
  `application/SlotFinder` (pure: input intervals → slots), sliced by the step, beyond notice and
  within the horizon. Property tests: no slot overlaps a busy interval, DST days, windows across
  midnight refused at validation.
- `change_requests` gain `kind EXTRA` (new lesson) beside MOVE / CANCEL; a MOVE from a slot is a
  normal MOVE with the proposed time. Approving EXTRA creates a single lesson
  (`ScheduleService.create`) for the student with the default topic, overlap check as today
  (a race between two students on one slot: the second approval gets `409 schedule.overlap` and the
  request is declined with an automatic comment).
- Auto-confirm mode (decision 1): the request is created and approved in one transaction under a
  lock on the slot (`select … for update` on `booking_settings` row is enough for one teacher).
- Events: `LessonChangeRequested` already exists — add `ChangeKind.EXTRA`; notifications texts for
  it; the teacher's bot `AnswerRequestsChatAction` handles it.
- REST: teacher `GET/PUT /api/teacher/schedule/booking` (windows and settings), per-student switch
  in the student profile; student `GET /api/me/schedule/slots?from&to&lessonId?` (for a move, the
  length is that lesson's), `POST /api/me/schedule/requests` with `kind=EXTRA`.

## Stages

- [ ] **A.1** (B) ADR; migration; `SlotFinder` with property tests; windows/settings REST + tests.
- [ ] **A.2** (B) Slots endpoint for students (only allowed students; another student's lesson id →
  404), `EXTRA` requests, approval → lesson, overlap race test, auto-confirm, notifications texts.
- [ ] **A.3** (B) Bot: student «Записаться на занятие» (`schedule/chat`) — days, then slots as
  buttons; teacher answers as today.
- [ ] **B.1** (F) Settings category «Расписание и календарь»: «Время для записи» card (weekly
  windows editor like off-time, `off-time-dialog.ts` as the model), settings, per-student switch
  on the Profile tab.
- [ ] **B.2** (F) Student: `schedule/student/change-request-dialog.ts` «Перенести» shows free slots
  as chips by day (with «Другое время» fallback to the current free input); «Записаться» action
  on the schedule page and home; teacher's calendar shows open windows as a light background.
- [ ] **C.1** Docs: `docs/modules/schedule.md`, wiki «Расписание», help ru/en, E2E
  `e2e/tests/schedule/booking.spec.ts` (window → student books → teacher approves → lesson).
- [ ] **D.1** (phase 2, by decision 4) public booking page and trial requests — plan separately;
  it needs spam protection without CAPTCHA services (rate limit + honeypot + email/phone check).

## Risks and out of scope

- Google busy times are refreshed every minute (`GoogleSyncJob`): a slot may be taken in Google a
  minute before a booking — approval re-checks busy times.
- Paid booking (prepayment) — out of scope.
