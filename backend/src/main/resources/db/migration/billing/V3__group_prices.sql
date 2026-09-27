-- Lesson price of a group of students (ADR-0011): a group lesson is charged to every participant at
-- this price. group_id refers to identity groups by value only.

create table group_prices (
    group_id     uuid                     primary key,
    lesson_price bigint                   not null,
    created_at   timestamp with time zone not null,
    updated_at   timestamp with time zone not null,
    version      bigint                   not null,
    constraint ck_group_prices_price check (lesson_price >= 0)
);
