-- Meetings module (ADR-0012): permanent video rooms of students and groups, the connection to
-- Yandex (Telemost API) and pending OAuth authorizations. owner_id refers to identity students and
-- groups by value only.

create table rooms (
    id            uuid                     primary key,
    owner_type    varchar(8)               not null,
    owner_id      uuid                     not null,
    join_url      varchar(1000)            not null,
    conference_id varchar(200),
    source        varchar(8)               not null,
    created_at    timestamp with time zone not null,
    updated_at    timestamp with time zone not null,
    version       bigint                   not null,
    constraint ux_rooms_owner unique (owner_id),
    constraint ck_rooms_owner_type check (owner_type in ('STUDENT', 'GROUP')),
    constraint ck_rooms_source check (source in ('API', 'MANUAL'))
);

-- The teacher's Yandex account: one row per instance.
create table yandex_connection (
    id               integer                  primary key,
    client_id        varchar(300),
    client_secret    varchar(300),
    access_token     varchar(1000),
    refresh_token    varchar(1000),
    access_expires_at timestamp with time zone,
    status           varchar(24)              not null,
    waiting_room     boolean                  not null,
    last_error       varchar(1000),
    connected_at     timestamp with time zone,
    updated_at       timestamp with time zone not null,
    constraint ck_yandex_connection_single check (id = 1),
    constraint ck_yandex_connection_status check (status in ('NOT_CONNECTED', 'CONNECTED', 'NEEDS_RECONNECT'))
);

-- A started authorization: the state parameter is stored as a hash and used once.
create table yandex_oauth_states (
    state_hash   varchar(64)              primary key,
    redirect_uri varchar(1000)            not null,
    expires_at   timestamp with time zone not null
);
