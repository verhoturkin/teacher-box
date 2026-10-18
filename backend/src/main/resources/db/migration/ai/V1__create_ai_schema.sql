-- AI module: log of LLM requests for usage accounting and the monthly token limit (ADR-0006), the teacher's
-- prompts and system prompts. Only metadata of requests is stored: prompts and answers (which may contain
-- students' work) are not kept.

create table requests (
    id            uuid                     primary key,
    feature       varchar(32)              not null,
    provider      varchar(32)              not null,
    model         varchar(100)             not null,
    status        varchar(16)              not null,
    input_tokens  bigint                   not null,
    output_tokens bigint                   not null,
    duration_ms   bigint                   not null,
    error         varchar(1000),
    created_at    timestamp with time zone not null,
    constraint ck_requests_status check (status in ('SUCCEEDED', 'FAILED', 'REFUSED'))
);

create index ix_requests_created on requests (created_at);

-- The teacher's library of prompts for drafts of homework.
create table prompts (
    id         uuid                     primary key,
    title      varchar(100)             not null,
    text       varchar(4000)            not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    version    bigint                   not null
);

-- System prompts the teacher rewrote (ADR-0043); a feature without a row uses the default from the resources.
create table system_prompts (
    feature    varchar(32)              primary key,
    text       varchar(10000)           not null,
    updated_at timestamp with time zone not null,
    version    bigint                   not null,
    constraint ck_system_prompts_feature check (feature in ('HOMEWORK_DRAFT', 'REVIEW_DRAFT'))
);
