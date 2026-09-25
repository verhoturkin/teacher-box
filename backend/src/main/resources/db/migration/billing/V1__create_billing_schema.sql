-- Billing module: lesson prices, the lesson log (charges) and payments.
-- Amounts are stored in minor units (kopecks) of the instance currency.
-- student_id refers to identity users by value only: no foreign keys across module schemas.

create table student_accounts (
    student_id   uuid                     primary key,
    lesson_price bigint                   not null,
    created_at   timestamp with time zone not null,
    updated_at   timestamp with time zone not null,
    version      bigint                   not null,
    constraint ck_student_accounts_price check (lesson_price >= 0)
);

create table lessons (
    id               uuid                     primary key,
    student_id       uuid                     not null,
    lesson_date      date                     not null,
    duration_minutes integer                  not null,
    price            bigint                   not null,
    topic            varchar(500),
    status           varchar(16)              not null,
    created_at       timestamp with time zone not null,
    cancelled_at     timestamp with time zone,
    cancel_reason    varchar(500),
    constraint ck_lessons_status check (status in ('CONDUCTED', 'MISSED', 'CANCELLED')),
    constraint ck_lessons_price check (price >= 0),
    constraint ck_lessons_duration check (duration_minutes between 1 and 600)
);

create index ix_lessons_student_date on lessons (student_id, lesson_date);
create index ix_lessons_date on lessons (lesson_date);

create table payments (
    id          uuid                     primary key,
    student_id  uuid                     not null,
    amount      bigint                   not null,
    paid_on     date                     not null,
    method      varchar(16)              not null,
    comment     varchar(500),
    created_at  timestamp with time zone not null,
    voided_at   timestamp with time zone,
    void_reason varchar(500),
    constraint ck_payments_amount check (amount > 0),
    constraint ck_payments_method check (method in ('CASH', 'CARD', 'TRANSFER', 'OTHER'))
);

create index ix_payments_student_date on payments (student_id, paid_on);
create index ix_payments_date on payments (paid_on);
