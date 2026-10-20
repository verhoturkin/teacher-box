-- The preview picture of an Excalidraw board (PNG exported by the editor on save): one file of the boards
-- namespace in FileStorage per board.

create table board_previews (
    board_id     uuid                     primary key references boards (id) on delete cascade,
    file_key     varchar(36)              not null,
    size         bigint                   not null,
    updated_at   timestamp with time zone not null
);
