-- Parents (guardians) of students (ADR-0069): a guardian is a user of role GUARDIAN linked to one or
-- more students; a student has at most two guardians (checked by the service).

alter table users drop constraint ck_users_role;
alter table users add constraint ck_users_role check (role in ('TEACHER', 'STUDENT', 'ADMIN', 'GUARDIAN'));

create table guardianships (
    guardian_id uuid                     not null,
    student_id  uuid                     not null,
    created_at  timestamp with time zone not null,
    constraint pk_guardianships primary key (guardian_id, student_id),
    constraint fk_guardianships_guardian foreign key (guardian_id) references users (id),
    constraint fk_guardianships_student foreign key (student_id) references users (id)
);

create index ix_guardianships_student on guardianships (student_id);
