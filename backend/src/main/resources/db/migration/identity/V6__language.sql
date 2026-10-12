-- 0.11.1: the language the user chose in the interface; notifications, bot messages and calendars are
-- written in it (ADR-0036).

alter table users add column language varchar(8) default 'ru' not null;
