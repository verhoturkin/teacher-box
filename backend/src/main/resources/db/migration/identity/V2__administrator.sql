-- The administrator (ADR-0010): a technical account without access to students' data.

alter table users drop constraint ck_users_role;
alter table users add constraint ck_users_role check (role in ('TEACHER', 'STUDENT', 'ADMIN'));

alter table users drop constraint ck_users_teacher_marker;
alter table users add constraint ck_users_teacher_marker check (
    (role = 'TEACHER' and teacher_marker = true) or (role <> 'TEACHER' and teacher_marker is null));
