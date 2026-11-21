-- The bank of assignments (stage 462.1, roadmap 11 «Bank», ADR-0071). A bank item (bank = true) is an original kept
-- for reuse: content only, never given out; a working item (bank = false) is an assignment for students, as before.
-- source_id - the bank item a working item came from or was saved as; deleting the original keeps its copies.
-- Existing assignments are working items without a source: the migration puts nothing into the bank.
alter table assignments add column bank boolean default false not null;
alter table assignments add column source_id uuid references assignments (id) on delete set null;

create index ix_assignments_bank on assignments (bank, created_at);
create index ix_assignments_source on assignments (source_id);
