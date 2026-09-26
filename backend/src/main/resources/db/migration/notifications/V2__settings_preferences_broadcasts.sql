-- Bots configured in the settings page (environment variables take precedence), recipients'
-- preferences (topics not sent to messengers, quiet hours) and the history of the teacher's messages.

create table channel_settings (
    channel    varchar(16)              primary key,
    token      varchar(500)             not null,
    group_id   bigint,
    bot_name   varchar(200),
    updated_at timestamp with time zone not null,
    constraint ck_channel_settings_channel check (channel in ('TELEGRAM', 'VK', 'MAX'))
);

create table preferences (
    recipient_id uuid                     primary key,
    muted_topics varchar(200)             not null,
    quiet_from   time,
    quiet_to     time,
    updated_at   timestamp with time zone not null
);

create table broadcasts (
    id         uuid                     primary key,
    title      varchar(300)             not null,
    body       varchar(4000),
    recipients integer                  not null,
    created_at timestamp with time zone not null
);

create index ix_broadcasts_created on broadcasts (created_at);
