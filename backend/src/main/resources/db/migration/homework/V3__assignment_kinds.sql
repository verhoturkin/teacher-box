-- Kinds of homework: written (text, textbooks, files), on a board, interactive (an HTML page with its own checks,
-- ADR-0040). Existing assignments are written ones.

alter table assignments add column kind varchar(16) default 'WRITTEN' not null;
alter table assignments add constraint ck_assignments_kind check (kind in ('WRITTEN', 'BOARD', 'INTERACTIVE'));
alter table assignments add column interactive_html character large object;
