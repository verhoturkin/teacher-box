-- Schedule module: weekly series, lessons of a student or a group with their participants (ADR-0011), students'
-- change requests, sent reminders, calendar feeds, the teacher's Google Calendar and time off. Times are instants
-- in UTC; a series keeps its local time and the lessons are generated in the instance time zone. student_id and
-- group_id refer to identity by value only.

create table series (
    id               uuid                     primary key,
    student_id       uuid,
    group_id         uuid,
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
    constraint ck_series_interval check (interval_weeks between 1 and 4),
    constraint ck_series_owner check ((student_id is null) <> (group_id is null))
);

create index ix_series_student on series (student_id);
create index ix_series_group on series (group_id);

create table lessons (
    id                 uuid                     primary key,
    -- The group of a group lesson; the students are the participants.
    group_id           uuid,
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
    created_at         timestamp with time zone not null,
    updated_at         timestamp with time zone not null,
    version            bigint                   not null,
    constraint fk_lessons_series foreign key (series_id) references series (id),
    constraint ck_lessons_status check (status in ('SCHEDULED', 'CONDUCTED', 'MISSED', 'CANCELLED')),
    constraint ck_lessons_cancelled_by check (cancelled_by in ('TEACHER', 'STUDENT')),
    constraint ck_lessons_duration check (duration_minutes between 1 and 600)
);

create index ix_lessons_starts on lessons (starts_at);
create index ix_lessons_group on lessons (group_id, starts_at);
create unique index ux_lessons_series_date on lessons (series_id, series_date);

-- The students of a lesson with their attendance; a charged outcome has a completion id for billing.
create table lesson_participants (
    lesson_id     uuid        not null,
    student_id    uuid        not null,
    position      integer     not null,
    attendance    varchar(16) not null,
    completion_id uuid,
    constraint pk_lesson_participants primary key (lesson_id, student_id),
    constraint fk_lesson_participants_lesson foreign key (lesson_id) references lessons (id) on delete cascade,
    constraint ck_lesson_participants_attendance
        check (attendance in ('EXPECTED', 'ATTENDED', 'MISSED', 'EXCUSED')),
    constraint ck_lesson_participants_completion
        check ((completion_id is null) = (attendance in ('EXPECTED', 'EXCUSED')))
);

create index ix_lesson_participants_student on lesson_participants (student_id, lesson_id);
create unique index ux_lesson_participants_completion on lesson_participants (completion_id);

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

-- Google Calendar of the teacher: one connection per instance, pending OAuth authorizations and the lessons
-- that Teacher Box put into the calendar (the event id is the lesson id without dashes).
create table google_connection (
    id            integer                  primary key,
    client_id     varchar(300),
    client_secret varchar(300),
    refresh_token varchar(1000),
    calendar_id   varchar(300),
    busy_enabled  boolean                  not null,
    status        varchar(24)              not null,
    last_error    varchar(1000),
    last_sync_at  timestamp with time zone,
    connected_at  timestamp with time zone,
    updated_at    timestamp with time zone not null,
    constraint ck_google_connection_single check (id = 1),
    constraint ck_google_connection_status check (status in ('NOT_CONNECTED', 'CONNECTED', 'NEEDS_RECONNECT'))
);

-- A started authorization: the state parameter is stored as a hash and used once.
create table google_oauth_states (
    state_hash   varchar(64)              primary key,
    redirect_uri varchar(1000)            not null,
    busy         boolean                  not null,
    expires_at   timestamp with time zone not null
);

create table google_events (
    lesson_id      uuid                     primary key,
    synced_version bigint                   not null,
    synced_at      timestamp with time zone not null
);

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
