-- AI module: log of LLM requests for usage accounting and the monthly token limit (ADR-0006).
-- Only metadata is stored: prompts and answers (which may contain students' work) are not kept.

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
