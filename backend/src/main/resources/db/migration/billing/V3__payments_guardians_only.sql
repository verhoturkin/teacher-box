-- Students whose payments only their guardians see (ADR-0069, 451.3): the teacher switched it on in the student
-- card. A row is effective only while the student has a guardian; unlinking the last one deletes it.
create table payments_guardians_only (
    student_id uuid                     primary key,
    created_at timestamp with time zone not null
);
