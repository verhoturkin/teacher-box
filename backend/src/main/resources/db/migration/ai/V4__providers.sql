-- Several AI providers with several models each and one default model (ADR-0057). The connection settings
-- that were TEACHERBOX_AI_* variables are rows here: the old values are imported once (ADR-0056).

create table providers (
    id         uuid                     primary key,
    kind       varchar(32)              not null,
    name       varchar(60)              not null,
    api_key    varchar(1000),
    base_url   varchar(500),
    proxy      varchar(500),
    position   int                      not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    version    bigint                   not null,
    constraint ck_providers_kind check (kind in ('anthropic', 'gemini', 'openrouter', 'deepseek',
        'openai-compatible'))
);

create table models (
    id              uuid         primary key,
    provider_id     uuid         not null,
    model_id        varchar(120) not null,
    label           varchar(60)  not null,
    effort          varchar(16),
    fallbacks       boolean      not null,
    max_tokens      bigint       not null,
    timeout_seconds int          not null,
    position        int          not null,
    version         bigint       not null,
    constraint fk_models_provider foreign key (provider_id) references providers (id) on delete cascade,
    constraint uq_models_provider_model unique (provider_id, model_id),
    constraint ck_models_limits check (max_tokens > 0 and timeout_seconds > 0)
);

-- One row (id = 1) once anything is set; without it there is no default model and the limit is the default one.
create table settings (
    id                  int    primary key,
    default_model_id    uuid,
    monthly_token_limit bigint not null,
    version             bigint not null,
    constraint ck_settings_single check (id = 1),
    constraint ck_settings_limit check (monthly_token_limit >= 0),
    constraint fk_settings_default_model foreign key (default_model_id) references models (id) on delete set null
);

-- The model of the request among the configured ones; null for requests made before ADR-0057 or for a model
-- removed since (the provider and model names stay in the row).
alter table requests add column model_id uuid;
