-- Homework has no kinds any more (ADR-0041): a saved prompt is for any assignment.

alter table prompts drop constraint ck_prompts_kind;
alter table prompts drop column kind;
