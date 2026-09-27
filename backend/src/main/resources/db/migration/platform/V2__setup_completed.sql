-- First setup (ADR-0014): when the teacher finished or skipped it; empty means the wizard opens.

alter table portal_settings add column setup_completed_at timestamp with time zone;
