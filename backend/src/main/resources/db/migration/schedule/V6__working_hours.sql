-- The teacher's working hours (405.3): one range of every day in the teacher's zone, 'HH:mm'; empty — the
-- default 08:00–21:00. Free times to move a lesson and the calendar's hours follow them.
alter table settings add column work_start varchar(5);
alter table settings add column work_end varchar(5);
