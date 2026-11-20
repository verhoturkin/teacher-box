-- The course of an assignment (ADR-0071): a textbooks course by value, checked through textbooks::api.Courses
-- and cleared when the course is deleted (CourseDeleted). Null — none.
alter table assignments add column course_id uuid;

create index ix_assignments_course on assignments (course_id);
