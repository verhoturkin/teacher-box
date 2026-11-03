-- Free-text student tags (ADR-0055): a tag is a LIST of values or a TEXT the teacher types per student.
alter table tags add column kind varchar(8) default 'LIST' not null;
alter table tags add constraint ck_tags_kind check (kind in ('LIST', 'TEXT'));

alter table student_tags add column text varchar(120);
alter table student_tags alter column value_id set null;
alter table student_tags add constraint ck_student_tags_one check ((value_id is null) <> (text is null));
