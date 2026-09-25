-- Identity module: users (the teacher and students), invitation links and refresh tokens.

create table users (
    id             uuid                     primary key,
    role           varchar(16)              not null,
    -- TRUE for the teacher only; the unique constraint guarantees at most one teacher per instance.
    teacher_marker boolean,
    login          varchar(64),
    password_hash  varchar(255),
    display_name   varchar(100)             not null,
    email          varchar(254),
    phone          varchar(32),
    note           varchar(2000),
    status         varchar(16)              not null,
    failed_logins  integer                  not null default 0,
    locked_until   timestamp with time zone,
    created_at     timestamp with time zone not null,
    updated_at     timestamp with time zone not null,
    version        bigint                   not null,
    constraint uq_users_login unique (login),
    constraint uq_users_single_teacher unique (teacher_marker),
    constraint ck_users_role check (role in ('TEACHER', 'STUDENT')),
    constraint ck_users_status check (status in ('INVITED', 'ACTIVE', 'DEACTIVATED')),
    constraint ck_users_teacher_marker check (
        (role = 'TEACHER' and teacher_marker = true) or (role = 'STUDENT' and teacher_marker is null))
);

create table invites (
    id         uuid                     primary key,
    user_id    uuid                     not null,
    purpose    varchar(16)              not null,
    token_hash varchar(64)              not null,
    created_at timestamp with time zone not null,
    expires_at timestamp with time zone not null,
    used_at    timestamp with time zone,
    revoked_at timestamp with time zone,
    constraint uq_invites_token unique (token_hash),
    constraint fk_invites_user foreign key (user_id) references users (id),
    constraint ck_invites_purpose check (purpose in ('ACTIVATION', 'PASSWORD_RESET'))
);

create index ix_invites_user on invites (user_id);

create table refresh_tokens (
    id          uuid                     primary key,
    user_id     uuid                     not null,
    family_id   uuid                     not null,
    token_hash  varchar(64)              not null,
    created_at  timestamp with time zone not null,
    expires_at  timestamp with time zone not null,
    revoked_at  timestamp with time zone,
    replaced_by uuid,
    constraint uq_refresh_tokens_token unique (token_hash),
    constraint fk_refresh_tokens_user foreign key (user_id) references users (id)
);

create index ix_refresh_tokens_user on refresh_tokens (user_id);
create index ix_refresh_tokens_family on refresh_tokens (family_id);
