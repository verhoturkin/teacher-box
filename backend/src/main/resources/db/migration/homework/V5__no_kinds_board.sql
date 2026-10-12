-- Homework has no kinds any more (ADR-0041 supersedes ADR-0040): every assignment is a written one; the page of
-- interactive homework and the results it reported are dropped. An assignment remembers the board it was put on.

alter table assignments drop constraint ck_assignments_kind;
alter table assignments drop column kind;
alter table assignments drop column interactive_html;
alter table submissions drop column result;
alter table assignments add column board_id uuid;
