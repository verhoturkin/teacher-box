-- 0.13.0: the topic a new lesson or series with the student or the group gets unless the teacher types another.

alter table users add column default_topic varchar(500);
alter table student_groups add column default_topic varchar(500);
