-- Boards v2 (ADR-0028): a board is our own Excalidraw board or an external board by link, bound to any
-- number of students and groups. The single-owner links of 1.4-1.6 are not migrated: they are deleted.
-- member_id refers to identity students and groups by value only.

drop table boards;

create table boards (
    id         uuid                     primary key,
    kind       varchar(10)              not null,
    title      varchar(200)             not null,
    url        varchar(1000),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    version    bigint                   not null,
    constraint ck_boards_kind check (kind in ('EXCALIDRAW', 'LINK')),
    constraint ck_boards_url check ((kind = 'LINK' and url is not null) or (kind = 'EXCALIDRAW' and url is null))
);

create index ix_boards_created on boards (created_at, id);

create table board_members (
    board_id    uuid       not null references boards (id) on delete cascade,
    member_type varchar(8) not null,
    member_id   uuid       not null,
    primary key (board_id, member_type, member_id),
    constraint ck_board_members_type check (member_type in ('STUDENT', 'GROUP'))
);

create index ix_board_members_member on board_members (member_id);

-- The Excalidraw scene: elements (with tombstones of deleted ones) and the whitelisted appState as JSON.
create table board_scenes (
    board_id      uuid                     primary key references boards (id) on delete cascade,
    elements      clob                     not null,
    app_state     clob                     not null,
    scene_version bigint                   not null,
    updated_at    timestamp with time zone not null,
    updated_by    uuid
);

-- Images of a board: Excalidraw's fileId -> a file of the boards namespace in FileStorage.
create table board_files (
    board_id     uuid                     not null references boards (id) on delete cascade,
    file_id      varchar(100)             not null,
    file_key     varchar(36)              not null,
    content_type varchar(20)              not null,
    size         bigint                   not null,
    created_at   timestamp with time zone not null,
    primary key (board_id, file_id)
);

create table board_backups (
    id            uuid                     primary key,
    board_id      uuid                     not null references boards (id) on delete cascade,
    kind          varchar(8)               not null,
    elements      clob                     not null,
    app_state     clob                     not null,
    scene_version bigint                   not null,
    created_at    timestamp with time zone not null,
    constraint ck_board_backups_kind check (kind in ('DAILY', 'MANUAL'))
);

create index ix_board_backups_board on board_backups (board_id, created_at);
