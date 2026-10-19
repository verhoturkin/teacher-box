-- The colour of a student and of a group in the teacher's lists (a name of the palette; null: none).
alter table users add column color varchar(16);
alter table student_groups add column color varchar(16);
