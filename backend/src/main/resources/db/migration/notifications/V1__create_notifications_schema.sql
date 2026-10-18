-- Notifications module: personal inbox, messenger bindings, the delivery outbox (ADR-0005), bots configured in
-- the settings, recipients' preferences, the teacher's messages and dialogs with the bots (ADR-0013).
-- recipient_id refers to identity users by value only: no foreign keys across module schemas.

create table inbox (
    id           uuid                     primary key,
    recipient_id uuid                     not null,
    kind         varchar(32)              not null,
    title        varchar(300)             not null,
    body         varchar(4000),
    link         varchar(500),
    created_at   timestamp with time zone not null,
    read_at      timestamp with time zone
);

create index ix_inbox_recipient on inbox (recipient_id, created_at);

-- A recipient's account in a messenger (Telegram chat, VK user, MAX user).
create table channel_links (
    id           uuid                     primary key,
    recipient_id uuid                     not null,
    channel      varchar(16)              not null,
    external_id  varchar(64)              not null,
    display_name varchar(200),
    enabled      boolean                  not null,
    linked_at    timestamp with time zone not null,
    constraint uq_channel_links_recipient unique (recipient_id, channel),
    constraint ck_channel_links_channel check (channel in ('TELEGRAM', 'VK', 'MAX'))
);

-- One messenger account may serve several recipients (e.g. a parent of two students).
create index ix_channel_links_external on channel_links (channel, external_id);

-- One-time codes that connect a messenger account to a recipient. Only hashes are stored.
create table link_codes (
    code_hash    varchar(64)              primary key,
    recipient_id uuid                     not null,
    channel      varchar(16)              not null,
    created_at   timestamp with time zone not null,
    expires_at   timestamp with time zone not null,
    used_at      timestamp with time zone
);

create index ix_link_codes_recipient on link_codes (recipient_id, channel);

-- Outbox: one row per notification and external channel, retried until sent or failed.
create table deliveries (
    id              uuid                     primary key,
    notification_id uuid                     not null,
    recipient_id    uuid                     not null,
    channel         varchar(16)              not null,
    external_id     varchar(64)              not null,
    text            varchar(5000)            not null,
    status          varchar(16)              not null,
    attempts        integer                  not null,
    next_attempt_at timestamp with time zone not null,
    last_error      varchar(1000),
    created_at      timestamp with time zone not null,
    sent_at         timestamp with time zone,
    -- Buttons of the notification in the messenger (JSON rows of buttons).
    keyboard        varchar(8000),
    constraint fk_deliveries_notification foreign key (notification_id) references inbox (id),
    constraint ck_deliveries_status check (status in ('PENDING', 'SENT', 'FAILED'))
);

create index ix_deliveries_due on deliveries (status, next_attempt_at);

-- Bots configured in the settings page (environment variables take precedence).
create table channel_settings (
    channel    varchar(16)              primary key,
    token      varchar(500)             not null,
    group_id   bigint,
    bot_name   varchar(200),
    updated_at timestamp with time zone not null,
    constraint ck_channel_settings_channel check (channel in ('TELEGRAM', 'VK', 'MAX'))
);

-- Topics not sent to messengers and quiet hours of a recipient.
create table preferences (
    recipient_id uuid                     primary key,
    muted_topics varchar(200)             not null,
    quiet_from   time,
    quiet_to     time,
    updated_at   timestamp with time zone not null
);

-- The history of the teacher's messages.
create table broadcasts (
    id         uuid                     primary key,
    title      varchar(300)             not null,
    body       varchar(4000),
    recipients integer                  not null,
    created_at timestamp with time zone not null
);

create index ix_broadcasts_created on broadcasts (created_at);

-- The dialog of a messenger chat: the account it acts for (several may be connected to one chat)
-- and the action waiting for the next message.
create table chat_dialogs (
    channel      varchar(16)              not null,
    external_id  varchar(64)              not null,
    recipient_id uuid,
    action_id    varchar(32),
    state        varchar(4000)            not null,
    expires_at   timestamp with time zone,
    updated_at   timestamp with time zone not null,
    constraint pk_chat_dialogs primary key (channel, external_id),
    constraint ck_chat_dialogs_channel check (channel in ('TELEGRAM', 'VK', 'MAX'))
);

-- Buttons under one message of the bot; pressing one removes the whole set.
create table chat_buttons (
    token        varchar(16)              primary key,
    recipient_id uuid                     not null,
    channel      varchar(16)              not null,
    external_id  varchar(64)              not null,
    action_id    varchar(32),
    state        varchar(4000)            not null,
    choices      varchar(8000)            not null,
    created_at   timestamp with time zone not null,
    expires_at   timestamp with time zone not null
);

create index ix_chat_buttons_expires on chat_buttons (expires_at);

-- Settings of the bots: a single row.
create table chat_settings (
    id              integer                  primary key,
    teacher_actions boolean                  not null,
    updated_at      timestamp with time zone not null,
    constraint ck_chat_settings_single check (id = 1)
);
