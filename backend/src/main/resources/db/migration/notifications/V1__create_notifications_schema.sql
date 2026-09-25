-- Notifications module: personal inbox, messenger bindings and the delivery outbox (ADR-0005).
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
    constraint fk_deliveries_notification foreign key (notification_id) references inbox (id),
    constraint ck_deliveries_status check (status in ('PENDING', 'SENT', 'FAILED'))
);

create index ix_deliveries_due on deliveries (status, next_attempt_at);
