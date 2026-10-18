-- Billing module: lesson prices, the lesson log (charges), payments with receipts and settings.
-- Amounts are stored in minor units (kopecks) of the instance currency.
-- student_id and group_id refer to identity by value only: no foreign keys across module schemas.

create table student_accounts (
    student_id   uuid                     primary key,
    lesson_price bigint                   not null,
    created_at   timestamp with time zone not null,
    updated_at   timestamp with time zone not null,
    version      bigint                   not null,
    constraint ck_student_accounts_price check (lesson_price >= 0)
);

-- Lesson price of a group of students (ADR-0011): a group lesson is charged to every participant at it.
create table group_prices (
    group_id     uuid                     primary key,
    lesson_price bigint                   not null,
    created_at   timestamp with time zone not null,
    updated_at   timestamp with time zone not null,
    version      bigint                   not null,
    constraint ck_group_prices_price check (lesson_price >= 0)
);

create table lessons (
    id                     uuid                     primary key,
    student_id             uuid                     not null,
    lesson_date            date                     not null,
    duration_minutes       integer                  not null,
    price                  bigint                   not null,
    topic                  varchar(500),
    status                 varchar(16)              not null,
    created_at             timestamp with time zone not null,
    cancelled_at           timestamp with time zone,
    cancel_reason          varchar(500),
    -- A lesson charged from the schedule remembers the outcome it came from (schedule events are
    -- delivered at least once, so the id makes the charge idempotent and lets it be revoked).
    schedule_completion_id uuid,
    constraint ck_lessons_status check (status in ('CONDUCTED', 'MISSED', 'CANCELLED')),
    constraint ck_lessons_price check (price >= 0),
    constraint ck_lessons_duration check (duration_minutes between 1 and 600)
);

create index ix_lessons_student_date on lessons (student_id, lesson_date);
create index ix_lessons_date on lessons (lesson_date);
create unique index ux_lessons_schedule_completion on lessons (schedule_completion_id);

create table payments (
    id           uuid                     primary key,
    student_id   uuid                     not null,
    amount       bigint                   not null,
    paid_on      date                     not null,
    comment      varchar(500),
    created_at   timestamp with time zone not null,
    voided_at    timestamp with time zone,
    void_reason  varchar(500),
    -- A receipt (a picture or a PDF, one per payment); the file is in the namespace «billing» of the file storage.
    receipt_key  varchar(100),
    receipt_name varchar(255),
    receipt_type varchar(50),
    receipt_size bigint,
    constraint ck_payments_amount check (amount > 0)
);

create index ix_payments_student_date on payments (student_id, paid_on);
create index ix_payments_date on payments (paid_on);

-- Receipts sent to the bot whose payment is not recorded yet; removed with their files after a day.
create table pending_receipts (
    file_key   varchar(100)             primary key,
    created_at timestamp with time zone not null
);

-- Settings of the billing module (ADR-0014). A single row; an empty default lesson price means the
-- one from TEACHERBOX_BILLING_DEFAULT_LESSON_PRICE.
create table settings (
    id                   int                      primary key,
    default_lesson_price bigint,
    updated_at           timestamp with time zone,
    version              bigint                   not null,
    constraint ck_settings_single check (id = 1),
    constraint ck_settings_default_lesson_price check (default_lesson_price >= 0)
);

insert into settings (id, version) values (1, 0);
