-- Lesson summary (shared with participants), the plan for the next lesson and private notes per student.
alter table lessons add summary varchar(4000);
alter table lessons add next_plan varchar(1000);
alter table lessons add summary_updated_at timestamp with time zone;

create table lesson_notes (
    lesson_id uuid not null references lessons(id),
    student_id uuid not null,
    note varchar(4000) not null,
    updated_at timestamp with time zone not null,
    primary key (lesson_id, student_id)
);
