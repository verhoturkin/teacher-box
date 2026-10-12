-- 0.13.0: a receipt of a payment (a picture or a PDF, one per payment); the file is in the namespace
-- «billing» of the file storage.

alter table payments add column receipt_key varchar(100);
alter table payments add column receipt_name varchar(255);
alter table payments add column receipt_type varchar(50);
alter table payments add column receipt_size bigint;

-- Receipts sent to the bot whose payment is not recorded yet; removed with their files after a day.
create table pending_receipts (
    file_key   varchar(100)             primary key,
    created_at timestamp with time zone not null
);
