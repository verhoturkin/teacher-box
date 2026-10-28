-- Auto-checked questions of assignments (ADR-0052).
-- options / answer hold JSON whose shape depends on the type (see QuestionCodec); ids inside are stable.
alter table assignments add column quiz_reveal varchar(16) default 'AFTER_SUBMIT' not null;
-- Attempts a student may make; null - unlimited.
alter table assignments add column quiz_attempts smallint default 1;
alter table assignments add constraint ck_assignments_quiz_reveal
    check (quiz_reveal in ('AFTER_SUBMIT', 'AFTER_DUE', 'NEVER'));

create table assignment_questions (
    id            uuid          primary key,
    assignment_id uuid          not null references assignments (id) on delete cascade,
    position      int           not null,
    type          varchar(16)   not null,
    text          varchar(2000) not null,
    options       varchar(10000),
    answer        varchar(4000),
    points        smallint      not null,
    explanation   varchar(2000),
    constraint ck_assignment_questions_type check (type in
        ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_TEXT', 'NUMBER', 'MATCHING', 'ORDERING'))
);

create index ix_assignment_questions_assignment on assignment_questions (assignment_id, position);

create table quiz_attempts (
    id           uuid                     primary key,
    task_id      uuid                     not null references tasks (id),
    started_at   timestamp with time zone not null,
    submitted_at timestamp with time zone,
    score_points int,
    max_points   int
);

create index ix_quiz_attempts_task on quiz_attempts (task_id);

create table quiz_answers (
    attempt_id  uuid          not null references quiz_attempts (id) on delete cascade,
    question_id uuid          not null references assignment_questions (id) on delete cascade,
    answer      varchar(4000) not null,
    correct     boolean       not null,
    points      int           not null,
    overridden  boolean       not null,
    primary key (attempt_id, question_id)
);
