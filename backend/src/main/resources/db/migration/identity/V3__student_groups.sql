-- Groups of students taught together (ADR-0011). A student may be in several groups; the order of
-- members is the order the teacher chose.

create table student_groups (
    id          uuid                     primary key,
    name        varchar(100)             not null,
    archived_at timestamp with time zone,
    created_at  timestamp with time zone not null,
    updated_at  timestamp with time zone not null,
    version     bigint                   not null
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
