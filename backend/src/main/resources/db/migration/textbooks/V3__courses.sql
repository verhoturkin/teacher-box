-- Courses (ADR-0071): named programmes owned by textbooks. A textbook belongs to at most one course, a student
-- and a group study at most one current course, and a textbook can be shared with «Ученики курса» (member_type
-- COURSE: the students of the course and the members of its groups). Student and group ids are values only.

create table courses (
    id       uuid         primary key,
    name     varchar(100) not null,
    name_key varchar(100) not null,
    position integer      not null,
    version  bigint       not null,
    constraint uq_courses_name unique (name_key)
);

-- The free-text course of the textbooks becomes a course: distinct trimmed non-blank values, case-insensitive,
-- the spelling of the oldest textbook wins, positions by name.
insert into courses (id, name, name_key, position, version)
select random_uuid(), name, name_key, row_number() over (order by name_key, name) - 1, 0
from (
    select trim(course) as name, lower(trim(course)) as name_key,
           row_number() over (partition by lower(trim(course)) order by created_at, id) as spelling
    from textbooks
    where course is not null and trim(course) <> ''
) spellings
where spelling = 1;

alter table textbooks add column course_id uuid references courses (id);

update textbooks set course_id = (select c.id from courses c where c.name_key = lower(trim(textbooks.course)))
where course is not null and trim(course) <> '';

alter table textbooks drop column course;

create index ix_textbooks_course on textbooks (course_id);

create table student_courses (
    student_id uuid primary key,
    course_id  uuid not null references courses (id) on delete cascade
);

create index ix_student_courses_course on student_courses (course_id);

create table group_courses (
    group_id  uuid primary key,
    course_id uuid not null references courses (id) on delete cascade
);

create index ix_group_courses_course on group_courses (course_id);

alter table textbook_members drop constraint ck_textbook_members_type;
alter table textbook_members add constraint ck_textbook_members_type
    check (member_type in ('STUDENT', 'GROUP', 'COURSE'));
