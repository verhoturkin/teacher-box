-- System prompts the teacher rewrote (ADR-0043); a feature without a row uses the default from the resources.

create table system_prompts (
    feature    varchar(32)              primary key,
    text       varchar(10000)           not null,
    updated_at timestamp with time zone not null,
    version    bigint                   not null,
    constraint ck_system_prompts_feature check (feature in ('HOMEWORK_DRAFT', 'REVIEW_DRAFT'))
);
