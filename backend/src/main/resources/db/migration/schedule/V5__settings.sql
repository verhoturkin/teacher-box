-- The teacher's lesson rules (ADR-0056): a single row once one is set; an empty value is the default.
-- Durations are ISO-8601 (PT24H); reminders are comma-separated durations, '' — no reminders.
create table settings (
    id                int                      primary key,
    default_duration  int,
    late_cancellation varchar(30),
    reminders         varchar(200),
    horizon           varchar(30),
    updated_at        timestamp with time zone not null,
    version           bigint                   not null,
    constraint ck_settings_single check (id = 1),
    constraint ck_settings_default_duration check (default_duration between 1 and 600)
);
