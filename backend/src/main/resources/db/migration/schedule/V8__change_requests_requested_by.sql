-- Who sent a change request (stage 454.2): the student, or a guardian on the child's behalf (ADR-0069).
-- The requests before it were all sent by the students themselves.
alter table change_requests add column requested_by uuid;
update change_requests set requested_by = student_id;
alter table change_requests alter column requested_by set not null;
