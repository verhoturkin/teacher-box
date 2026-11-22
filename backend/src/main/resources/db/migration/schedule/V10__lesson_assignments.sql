-- Homework of a lesson (stage 462.1, roadmap 11): working assignments of homework, many per lesson and an assignment
-- on at most one lesson (the primary key). Only the assignment id crosses the module boundary: no foreign key to
-- homework; deleting the lesson deletes its links, the assignments stay.
create table lesson_assignments (
    assignment_id uuid    primary key,
    lesson_id     uuid    not null references lessons (id) on delete cascade,
    position      integer not null
);

create index ix_lesson_assignments_lesson on lesson_assignments (lesson_id, position);
