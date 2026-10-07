-- Textbooks (ADR-0033): one file each, shared with any number of students and groups.
-- member_id refers to identity students and groups by value only.

create table textbooks (
    id           uuid                     primary key,
    kind         varchar(10)              not null,
    title        varchar(200)             not null,
    course       varchar(100),
    page_count   integer,
    format       varchar(10)              not null,
    file_key     varchar(36)              not null,
    filename     varchar(255)             not null,
    content_type varchar(100)             not null,
    size         bigint                   not null,
    created_at   timestamp with time zone not null,
    updated_at   timestamp with time zone not null,
    version      bigint                   not null,
    constraint ck_textbooks_kind check (kind in ('TEXTBOOK', 'WORKBOOK', 'OTHER')),
    constraint ck_textbooks_format check (format in ('IMAGE', 'PDF', 'DOCUMENT'))
);

create index ix_textbooks_created on textbooks (created_at, id);

create table textbook_members (
    textbook_id uuid       not null references textbooks (id) on delete cascade,
    member_type varchar(8) not null,
    member_id   uuid       not null,
    primary key (textbook_id, member_type, member_id),
    constraint ck_textbook_members_type check (member_type in ('STUDENT', 'GROUP'))
);

create index ix_textbook_members_member on textbook_members (member_id);
