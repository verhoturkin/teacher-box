-- The teacher's time zone (ADR-0056), e.g. Europe/Moscow; empty: TEACHERBOX_TIMEZONE until 363.3 reads it.
alter table platform.portal_settings add column time_zone varchar(60);
