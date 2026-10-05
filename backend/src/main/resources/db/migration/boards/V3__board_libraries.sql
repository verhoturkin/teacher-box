-- The Excalidraw library of a user (1.7.1): the shapes they keep for any board, one row per user.
-- user_id refers to an identity user (the teacher or a student) by value only.
create table board_libraries (
    user_id    uuid                     primary key,
    items      clob                     not null,
    updated_at timestamp with time zone not null
);
