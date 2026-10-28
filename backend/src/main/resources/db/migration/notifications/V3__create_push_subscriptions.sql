-- Devices that receive web push (ADR-0051): one row per browser subscription of a user.
-- user_id refers to identity users by value only. The endpoint is the address of the device's account at
-- the push service, so it is never shown to the administrator or written to logs.
-- failures counts deliveries in a row that did not get through; a success resets it.

create table push_subscriptions (
    id              uuid                     primary key,
    user_id         uuid                     not null,
    endpoint        varchar(1000)            not null,
    p256dh          varchar(200)             not null,
    auth            varchar(100)             not null,
    user_agent      varchar(200),
    language        varchar(8),
    created_at      timestamp with time zone not null,
    last_success_at timestamp with time zone,
    failures        integer                  not null,
    constraint uq_push_subscriptions_endpoint unique (endpoint)
);

create index ix_push_subscriptions_user on push_subscriptions (user_id);
