-- Textbooks bound to assignments (ADR-0033): textbook_id refers to the textbooks module by value only.
-- pages - the normalized pages ("1-3, 7"); null - the whole textbook.

create table assignment_textbooks (
    assignment_id uuid                     not null references assignments (id) on delete cascade,
    textbook_id   uuid                     not null,
    pages         varchar(200),
    bound_at      timestamp with time zone not null,
    primary key (assignment_id, textbook_id)
);
