-- Meetings module (ADR-0012, ADR-0030): permanent rooms of students and groups by the external links the
-- teacher entered. owner_id refers to identity students and groups by value only.

create table rooms (
    id         uuid                     primary key,
    owner_type varchar(8)               not null,
    owner_id   uuid                     not null,
    join_url   varchar(1000)            not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    version    bigint                   not null,
    constraint ux_rooms_owner unique (owner_id),
    constraint ck_rooms_owner_type check (owner_type in ('STUDENT', 'GROUP'))
);
