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
