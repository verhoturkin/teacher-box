-- Dialogs with the bots (ADR-0013).

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

-- Buttons of a notification in a messenger (JSON rows of buttons).
alter table deliveries add column keyboard varchar(8000);
