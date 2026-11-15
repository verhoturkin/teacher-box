-- Keep compact deletion identities after pruning the full scene elements.
create table board_deleted_elements (
    board_id uuid not null references boards (id) on delete cascade,
    element_id varchar(100) not null,
    element_version bigint not null,
    deleted_at timestamp with time zone not null,
    retired boolean not null,
    primary key (board_id, element_id)
);
