-- Schedule module: weekly series, lessons, students' change requests, sent reminders and
-- calendar feeds. Times are instants in UTC; a series keeps its local time and the lessons are
-- generated in the instance time zone. student_id refers to identity users by value only.

create table series (
    id               uuid                     primary key,
    student_id       uuid                     not null,
    weekdays         varchar(80)              not null,
    start_time       time                     not null,
    duration_minutes integer                  not null,
    interval_weeks   integer                  not null,
    starts_on        date                     not null,
    ends_on          date,
    topic            varchar(500),
    meeting_url      varchar(1000),
    generated_until  date                     not null,
    created_at       timestamp with time zone not null,
    updated_at       timestamp with time zone not null,
    version          bigint                   not null,
    constraint ck_series_duration check (duration_minutes between 1 and 600),
    constraint ck_series_interval check (interval_weeks between 1 and 4)
);

create index ix_series_student on series (student_id);

create table lessons (
    id                 uuid                     primary key,
    student_id         uuid                     not null,
    series_id          uuid,
    series_date        date,
    starts_at          timestamp with time zone not null,
    ends_at            timestamp with time zone not null,
    duration_minutes   integer                  not null,
    topic              varchar(500),
    meeting_url        varchar(1000),
    status             varchar(16)              not null,
    cancelled_by       varchar(16),
    cancel_reason      varchar(500),
    original_starts_at timestamp with time zone,
    completion_id      uuid,
    created_at         timestamp with time zone not null,
    updated_at         timestamp with time zone not null,
    version            bigint                   not null,
    constraint fk_lessons_series foreign key (series_id) references series (id),
    constraint ck_lessons_status check (status in ('SCHEDULED', 'CONDUCTED', 'MISSED', 'CANCELLED')),
    constraint ck_lessons_cancelled_by check (cancelled_by in ('TEACHER', 'STUDENT')),
    constraint ck_lessons_duration check (duration_minutes between 1 and 600)
);

create index ix_lessons_starts on lessons (starts_at);
create index ix_lessons_student_starts on lessons (student_id, starts_at);
create unique index ux_lessons_series_date on lessons (series_id, series_date);

create table change_requests (
    id                 uuid                     primary key,
    lesson_id          uuid                     not null,
    student_id         uuid                     not null,
    kind               varchar(16)              not null,
    proposed_starts_at timestamp with time zone,
    comment            varchar(500),
    status             varchar(16)              not null,
    resolution_comment varchar(500),
    created_at         timestamp with time zone not null,
    resolved_at        timestamp with time zone,
    version            bigint                   not null,
    constraint fk_change_requests_lesson foreign key (lesson_id) references lessons (id) on delete cascade,
    constraint ck_change_requests_kind check (kind in ('RESCHEDULE', 'CANCEL')),
    constraint ck_change_requests_status
        check (status in ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN', 'OUTDATED'))
);

create index ix_change_requests_lesson on change_requests (lesson_id);
create index ix_change_requests_status on change_requests (status, created_at);
create index ix_change_requests_student on change_requests (student_id, created_at);

-- A reminder is sent once per lesson and advance time; rescheduling a lesson clears its rows.
create table reminders_sent (
    lesson_id      uuid                     not null,
    before_minutes integer                  not null,
    sent_at        timestamp with time zone not null,
    constraint pk_reminders_sent primary key (lesson_id, before_minutes),
    constraint fk_reminders_sent_lesson foreign key (lesson_id) references lessons (id) on delete cascade
);

-- Secret links to the calendar in iCalendar format; only a hash of the token is stored.
create table feeds (
    owner_id   uuid                     primary key,
    token_hash varchar(64)              not null,
    created_at timestamp with time zone not null,
    constraint ux_feeds_token unique (token_hash)
);
