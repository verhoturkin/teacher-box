-- Split every stored weekday rule, including ended and ungenerated ones, preserving its ISO-week phase.
create table repeat_rule_mapping (
    old_id uuid not null,
    new_id uuid not null,
    weekday varchar(9) not null,
    weekday_number integer not null,
    origin_date date not null
);
insert into repeat_rule_mapping
select s.id, random_uuid(), d.weekday, d.weekday_number,
    dateadd('DAY', mod(d.weekday_number - extract(iso_day_of_week from s.starts_on) + 7, 7)
        + case when d.weekday_number < extract(iso_day_of_week from s.starts_on)
               then (s.interval_weeks - 1) * 7 else 0 end, s.starts_on)
from series s cross join (
    values ('MONDAY', 1), ('TUESDAY', 2), ('WEDNESDAY', 3), ('THURSDAY', 4),
           ('FRIDAY', 5), ('SATURDAY', 6), ('SUNDAY', 7)
) d(weekday, weekday_number)
where locate(d.weekday, s.weekdays) > 0;

create table repeat_rules (
    id uuid primary key,
    student_id uuid,
    group_id uuid,
    weekdays varchar(80) not null,
    start_time time not null,
    duration_minutes integer not null check (duration_minutes between 1 and 600),
    interval_weeks integer not null check (interval_weeks between 1 and 4),
    starts_on date not null,
    ends_on date,
    topic varchar(500),
    meeting_url varchar(1000),
    generated_until date not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    version bigint not null,
    origin_date date not null,
    constraint ck_repeat_rule_owner check ((student_id is null) <> (group_id is null))
);
insert into repeat_rules
select m.new_id, s.student_id, s.group_id, m.weekday, s.start_time, s.duration_minutes,
       s.interval_weeks, s.starts_on, s.ends_on, s.topic, s.meeting_url, s.generated_until,
       s.created_at, s.updated_at, s.version, m.origin_date
from series s join repeat_rule_mapping m on m.old_id = s.id;

alter table lessons drop constraint fk_lessons_series;
update lessons l set series_id = (
    select m.new_id from repeat_rule_mapping m
    where m.old_id = l.series_id and m.weekday_number = extract(iso_day_of_week from l.series_date)
) where l.series_id is not null;
alter table lessons add constraint fk_lessons_repeat_rule foreign key (series_id) references repeat_rules(id);
alter table lessons add individually_changed boolean not null default false;
-- Protect all prior explicit edits, including topic/URL-only edits, not only moved lessons.
update lessons set individually_changed = true where original_starts_at is not null or updated_at > created_at;

create table repeat_exceptions (
    rule_id uuid not null references repeat_rules(id),
    occurrence_date date not null,
    primary key (rule_id, occurrence_date)
);
-- Missing occurrences inside a previously generated range are retained as suppressed dates.
insert into repeat_exceptions(rule_id, occurrence_date)
select r.id, dateadd('WEEK', n.x * r.interval_weeks, r.origin_date)
from repeat_rules r cross join system_range(0, (
    select coalesce(max(datediff('DAY', origin_date, generated_until) / 7), 0) from repeat_rules
)) n
where dateadd('WEEK', n.x * r.interval_weeks, r.origin_date) <= r.generated_until
  and (r.ends_on is null or dateadd('WEEK', n.x * r.interval_weeks, r.origin_date) <= r.ends_on)
  and not exists (select 1 from lessons l where l.series_id = r.id
      and l.series_date = dateadd('WEEK', n.x * r.interval_weeks, r.origin_date));
drop table repeat_rule_mapping;
drop table series;
create index ix_repeat_rule_student on repeat_rules(student_id);
create index ix_repeat_rule_group on repeat_rules(group_id);
