-- The teacher's library of prompts for drafts of homework; kind null - for any kind of homework.

create table prompts (
    id         uuid                     primary key,
    title      varchar(100)             not null,
    text       varchar(4000)            not null,
    kind       varchar(16),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    version    bigint                   not null,
    constraint ck_prompts_kind check (kind in ('WRITTEN', 'BOARD', 'INTERACTIVE'))
);
