create table item (
    id     bigint primary key,
    status varchar(16) not null,
    constraint ck_item_status check (status in ('NEW', 'DONE'))
);
