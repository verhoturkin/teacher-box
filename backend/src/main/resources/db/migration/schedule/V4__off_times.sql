-- Time the teacher does not work: once (from one instant to another) or every week on the given
-- weekdays from a local time to a local time of the instance time zone (an end not after the start
-- is on the next day). Students see it as busy time.

create table off_times (
    id         uuid                     primary key,
    kind       varchar(8)               not null,
    starts_at  timestamp with time zone,
    ends_at    timestamp with time zone,
    weekdays   varchar(80),
    start_time time,
    end_time   time,
    starts_on  date,
    ends_on    date,
    note       varchar(500),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    version    bigint                   not null,
    constraint ck_off_times_kind check (kind in ('ONCE', 'WEEKLY')),
    constraint ck_off_times_once check (kind <> 'ONCE' or (starts_at is not null and ends_at > starts_at)),
    constraint ck_off_times_weekly check (kind <> 'WEEKLY'
        or (weekdays is not null and start_time is not null and end_time is not null and starts_on is not null))
);

create index ix_off_times_ends on off_times (kind, ends_at);
