-- The old free text becomes the lesson's name; the topic (what the lesson covers) is new and per lesson (ADR-0053).
alter table lessons alter column topic rename to title;
alter table lessons add topic varchar(500);
alter table repeat_rules alter column topic rename to title;
