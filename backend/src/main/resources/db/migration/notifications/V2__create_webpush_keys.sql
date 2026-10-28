-- VAPID key pair of the portal (ADR-0051): created on the first start, one row. The subscriptions of the
-- devices are bound to the public key, so the pair goes into backups with the rest of the schema.
-- Both keys are base64url; the private one (a 32-byte scalar) is never given out.

create table webpush_keys (
    id          integer                  primary key,
    public_key  varchar(100)             not null,
    private_key varchar(100)             not null,
    created_at  timestamp with time zone not null,
    constraint ck_webpush_keys_single check (id = 1)
);
