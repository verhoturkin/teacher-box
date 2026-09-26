-- Group lessons (ADR-0011): a lesson has participants with their attendance and charges; a lesson
-- or a series belongs to one student or to a group. group_id and student_id refer to identity by
-- value only.

alter table series add column group_id uuid;
alter table series alter column student_id set null;
alter table series add constraint ck_series_owner check ((student_id is null) <> (group_id is null));
create index ix_series_group on series (group_id);

alter table lessons add column group_id uuid;
create index ix_lessons_group on lessons (group_id, starts_at);

create table lesson_participants (
    lesson_id     uuid        not null,
    student_id    uuid        not null,
    position      integer     not null,
    attendance    varchar(16) not null,
    completion_id uuid,
    constraint pk_lesson_participants primary key (lesson_id, student_id),
    constraint fk_lesson_participants_lesson foreign key (lesson_id) references lessons (id) on delete cascade,
    constraint ck_lesson_participants_attendance
        check (attendance in ('EXPECTED', 'ATTENDED', 'MISSED', 'EXCUSED')),
    constraint ck_lesson_participants_completion
        check ((completion_id is null) = (attendance in ('EXPECTED', 'EXCUSED')))
);

create index ix_lesson_participants_student on lesson_participants (student_id, lesson_id);
create unique index ux_lesson_participants_completion on lesson_participants (completion_id);

-- Every existing lesson is a lesson with one student; its outcome becomes the student's attendance.
insert into lesson_participants (lesson_id, student_id, position, attendance, completion_id)
select id, student_id, 0,
       case status when 'CONDUCTED' then 'ATTENDED' when 'MISSED' then 'MISSED' else 'EXPECTED' end,
       case when status in ('CONDUCTED', 'MISSED') then coalesce(completion_id, random_uuid()) end
from lessons;

drop index ix_lessons_student_starts;
alter table lessons drop column student_id;
alter table lessons drop column completion_id;
