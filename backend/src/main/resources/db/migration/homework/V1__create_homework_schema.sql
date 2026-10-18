-- Homework module: assignments, per-student tasks, submissions, attached files and bound textbooks.
-- student_id, board_id and textbook_id refer to other modules by value only: no foreign keys across schemas.

create table assignments (
    id          uuid                     primary key,
    title       varchar(200)             not null,
    description varchar(20000),
    due_at      timestamp with time zone,
    created_at  timestamp with time zone not null,
    updated_at  timestamp with time zone not null,
    version     bigint                   not null,
    -- The board the assignment was put on (ADR-0041).
    board_id    uuid
);

create table tasks (
    id                    uuid                     primary key,
    assignment_id         uuid                     not null,
    student_id            uuid                     not null,
    status                varchar(16)              not null,
    grade                 varchar(20),
    teacher_comment       varchar(5000),
    assigned_at           timestamp with time zone not null,
    submitted_at          timestamp with time zone,
    reviewed_at           timestamp with time zone,
    due_reminder_sent_at  timestamp with time zone,
    version               bigint                   not null,
    constraint fk_tasks_assignment foreign key (assignment_id) references assignments (id),
    constraint uq_tasks_assignment_student unique (assignment_id, student_id),
    constraint ck_tasks_status check (status in ('ASSIGNED', 'SUBMITTED', 'RETURNED', 'ACCEPTED'))
);

create index ix_tasks_student on tasks (student_id);
create index ix_tasks_status on tasks (status);

create table submissions (
    id           uuid                     primary key,
    task_id      uuid                     not null,
    text         varchar(20000),
    submitted_at timestamp with time zone not null,
    constraint fk_submissions_task foreign key (task_id) references tasks (id)
);

create index ix_submissions_task on submissions (task_id);

create table attachments (
    id           uuid                     primary key,
    owner_type   varchar(16)              not null,
    owner_id     uuid                     not null,
    file_key     varchar(64)              not null,
    filename     varchar(255)             not null,
    content_type varchar(100)             not null,
    size_bytes   bigint                   not null,
    sha256       varchar(64)              not null,
    uploaded_at  timestamp with time zone not null,
    constraint ck_attachments_owner check (owner_type in ('ASSIGNMENT', 'SUBMISSION'))
);

create index ix_attachments_owner on attachments (owner_type, owner_id);

-- Textbooks bound to assignments (ADR-0033). pages - the normalized pages ("1-3, 7"); null - the whole textbook.
create table assignment_textbooks (
    assignment_id uuid                     not null references assignments (id) on delete cascade,
    textbook_id   uuid                     not null,
    pages         varchar(200),
    bound_at      timestamp with time zone not null,
    primary key (assignment_id, textbook_id)
);
