-- First setup (ADR-0014): a password generated on the first start was written to the server log, so
-- the teacher has to replace it after signing in.

alter table users add column password_change_required boolean default false not null;
