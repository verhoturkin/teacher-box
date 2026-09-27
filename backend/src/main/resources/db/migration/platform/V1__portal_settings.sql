-- Platform (ADR-0014): settings of the portal as a whole. A single row; empty values mean the
-- defaults (the name "Teacher Box", no address).

create table portal_settings (
    id         int                      primary key,
    name       varchar(60),
    address    varchar(300),
    updated_at timestamp with time zone,
    version    bigint                   not null,
    constraint ck_portal_settings_single check (id = 1)
);

insert into portal_settings (id, version) values (1, 0);
