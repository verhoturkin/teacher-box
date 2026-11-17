-- Unmarked lessons (status + end) are counted on every summary (stage 419).
create index ix_lessons_status_ends on lessons (status, ends_at);
