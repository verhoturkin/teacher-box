-- 0.9.1: a student chooses the name shown in their cabinet (the teacher keeps the name from the profile)
-- and uploads a photo; the file lives in the identity namespace of the file storage.

alter table users add column own_name varchar(100);
alter table users add column avatar_key varchar(64);
alter table users add column avatar_type varchar(32);
