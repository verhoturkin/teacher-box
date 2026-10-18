-- Identity module: users (the teacher, students and the administrator), invitation links, refresh tokens and
-- groups of students.

create table users (
    id                       uuid                     primary key,
    role                     varchar(16)              not null,
    -- TRUE for the teacher only; the unique constraint guarantees at most one teacher per instance.
    teacher_marker           boolean,
    login                    varchar(64),
    password_hash            varchar(255),
    display_name             varchar(100)             not null,
    email                    varchar(254),
    phone                    varchar(32),
    note                     varchar(2000),
    status                   varchar(16)              not null,
    failed_logins            integer                  not null default 0,
    locked_until             timestamp with time zone,
    created_at               timestamp with time zone not null,
    updated_at               timestamp with time zone not null,
    version                  bigint                   not null,
    -- A password generated on the first start was written to the server log (ADR-0014): the teacher replaces it.
    password_change_required boolean                  default false not null,
    -- The name a student chose for their cabinet (the teacher keeps the one from the profile) and their photo
    -- in the identity namespace of the file storage.
    own_name                 varchar(100),
    avatar_key               varchar(64),
    avatar_type              varchar(32),
    -- The interface language; notifications, bot messages and calendars are written in it (ADR-0036).
    language                 varchar(8)               default 'ru' not null,
    -- The topic a new lesson or series with the student gets unless the teacher types another.
    default_topic            varchar(500),
    constraint uq_users_login unique (login),
    constraint uq_users_single_teacher unique (teacher_marker),
    -- The administrator (ADR-0010) is a technical account without access to students' data.
    constraint ck_users_role check (role in ('TEACHER', 'STUDENT', 'ADMIN')),
    constraint ck_users_status check (status in ('INVITED', 'ACTIVE', 'DEACTIVATED')),
    constraint ck_users_teacher_marker check (
        (role = 'TEACHER' and teacher_marker = true) or (role <> 'TEACHER' and teacher_marker is null))
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

-- Groups of students taught together (ADR-0011). A student may be in several groups; the order of
-- members is the order the teacher chose.
create table student_groups (
    id            uuid                     primary key,
    name          varchar(100)             not null,
    archived_at   timestamp with time zone,
    created_at    timestamp with time zone not null,
    updated_at    timestamp with time zone not null,
    version       bigint                   not null,
    default_topic varchar(500)
);

create table group_members (
    group_id   uuid    not null,
    student_id uuid    not null,
    position   integer not null,
    constraint pk_group_members primary key (group_id, student_id),
    constraint fk_group_members_group foreign key (group_id) references student_groups (id),
    constraint fk_group_members_student foreign key (student_id) references users (id)
);

create index ix_group_members_student on group_members (student_id);
