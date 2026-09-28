-- The color of the portal and its own logo (ADR-0015). Empty values mean the defaults: indigo and
-- the icon of the portal. The logo file lives in the storage namespace "platform".

alter table portal_settings add column accent varchar(20);
alter table portal_settings add column logo_key varchar(200);
alter table portal_settings add column logo_type varchar(40);
