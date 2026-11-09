-- The teacher's homework settings (ADR-0056): a single row once one is set; an empty value is the default.
-- due_soon_window: ISO-8601 duration of the reminder before the due date, e.g. PT24H.
create table settings (
    id              int                      primary key,
    due_soon_window varchar(30),
    updated_at      timestamp with time zone not null,
    version         bigint                   not null,
    constraint ck_settings_single check (id = 1)
);
