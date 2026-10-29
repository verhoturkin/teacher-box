-- Who a draft is meant for: kept until the assignment is given out, never shown to students.
create table assignment_draft_students (
    assignment_id uuid not null references assignments (id) on delete cascade,
    student_id    uuid not null,
    primary key (assignment_id, student_id)
);
