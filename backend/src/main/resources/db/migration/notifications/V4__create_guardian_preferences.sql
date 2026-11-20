-- The categories of a child's notices a guardian (ADR-0069) has switched off; no row — all four are on.
-- guardian_id refers to identity users by value only.

create table guardian_preferences (
    guardian_id    uuid                     primary key,
    off_categories varchar(200)             not null,
    updated_at     timestamp with time zone not null
);
