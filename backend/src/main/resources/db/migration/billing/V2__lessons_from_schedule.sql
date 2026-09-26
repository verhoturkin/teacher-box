-- A lesson charged from the schedule remembers the outcome it came from (schedule events are
-- delivered at least once, so the id makes the charge idempotent and lets it be revoked).
alter table lessons add column schedule_completion_id uuid;
create unique index ux_lessons_schedule_completion on lessons (schedule_completion_id);
