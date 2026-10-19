-- Videos of assignments by link (ADR-0047): YouTube, Rutube, VK Video or any other http(s) link.
-- transcript - lines "[m:ss] text" the AI reads; the student sees it only when transcript_shown.
create table assignment_videos (
    id               uuid          primary key,
    assignment_id    uuid          not null references assignments (id) on delete cascade,
    position         int           not null,
    url              varchar(500)  not null,
    provider         varchar(16)   not null,
    video_id         varchar(100),
    start_seconds    int,
    title            varchar(200),
    transcript       varchar(100000),
    transcript_shown boolean       not null,
    constraint ck_assignment_videos_provider check (provider in ('YOUTUBE', 'RUTUBE', 'VK', 'OTHER'))
);

create index ix_assignment_videos_assignment on assignment_videos (assignment_id, position);
