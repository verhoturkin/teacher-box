-- Boards module (ADR-0012): links to interactive boards (Holst or any other) of students and
-- groups. owner_id refers to identity students and groups by value only.

create table boards (
    id         uuid                     primary key,
    owner_type varchar(8)               not null,
    owner_id   uuid                     not null,
    title      varchar(200)             not null,
    url        varchar(1000)            not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    version    bigint                   not null,
    constraint ck_boards_owner_type check (owner_type in ('STUDENT', 'GROUP'))
);

create index ix_boards_owner on boards (owner_id, created_at);
