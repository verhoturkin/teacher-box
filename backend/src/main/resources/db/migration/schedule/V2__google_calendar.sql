-- Google Calendar of the teacher: one connection per instance, pending OAuth authorizations and
-- the lessons that Teacher Box put into the calendar (the event id is the lesson id without dashes).

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
