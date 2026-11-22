-- The plan of a lesson (stage 461.2, roadmap 11): a working lesson plan of textbooks, one per lesson and a plan on
-- at most one lesson. Null — the lesson has none. Only the id crosses the module boundary: no foreign key.
alter table lessons add column plan_id uuid;
create unique index ux_lessons_plan on lessons (plan_id);
