-- ADR-0030: the Telemost API and the Yandex connection are gone; rooms keep only the external links the
-- teacher entered (meetings created through the API stay as such links).

drop table yandex_oauth_states;
drop table yandex_connection;

alter table rooms drop constraint ck_rooms_source;
alter table rooms drop column source;
alter table rooms drop column conference_id;
