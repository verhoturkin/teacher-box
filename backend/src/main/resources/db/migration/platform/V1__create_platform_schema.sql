-- Platform (ADR-0014): settings of the portal as a whole. A single row; empty values mean the
-- defaults (the name "Teacher Box", no address, indigo and the icon of the portal, ADR-0015).

create table portal_settings (
    id                 int                      primary key,
    name               varchar(60),
    address            varchar(300),
    updated_at         timestamp with time zone,
    version            bigint                   not null,
    -- When the teacher finished or skipped the first setup; empty means the wizard opens.
    setup_completed_at timestamp with time zone,
    accent             varchar(20),
    -- The own logo of the portal: a file in the storage namespace "platform".
    logo_key           varchar(200),
    logo_type          varchar(40),
    constraint ck_portal_settings_single check (id = 1)
);

insert into portal_settings (id, version) values (1, 0);
