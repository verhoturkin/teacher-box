-- Lesson plans (roadmap 11, ADR-0071): a Markdown plan with textbook pages and videos. A bank item (bank = true) is
-- an original kept for reuse; a working item (bank = false) is a plan for one lesson, the link is kept by schedule.
-- source_id - the bank item a working item came from or was saved as; deleting the original keeps its copies.
create table lesson_plans (
    id         uuid                     primary key,
    title      varchar(200)             not null,
    body       varchar(20000)           not null,
    course_id  uuid                     references courses (id) on delete set null,
    bank       boolean                  not null,
    source_id  uuid                     references lesson_plans (id) on delete set null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    version    bigint                   not null
);

create index ix_lesson_plans_bank on lesson_plans (bank, updated_at);
create index ix_lesson_plans_source on lesson_plans (source_id);
create index ix_lesson_plans_course on lesson_plans (course_id);

-- Textbooks of a plan, the rules of homework's assignment_textbooks: pages - the normalized pages ("1-3, 7");
-- null - the whole textbook. A deleted textbook leaves its plans.
create table lesson_plan_textbooks (
    plan_id     uuid         not null references lesson_plans (id) on delete cascade,
    textbook_id uuid         not null references textbooks (id) on delete cascade,
    position    int          not null,
    pages       varchar(200),
    primary key (plan_id, textbook_id)
);

create index ix_lesson_plan_textbooks_textbook on lesson_plan_textbooks (textbook_id);

-- Videos of a plan, the shape of homework's assignment_videos (ADR-0047): up to 5, the transcript shown to the
-- student only with transcript_shown.
create table lesson_plan_videos (
    id               uuid          primary key,
    plan_id          uuid          not null references lesson_plans (id) on delete cascade,
    position         int           not null,
    url              varchar(500)  not null,
    provider         varchar(16)   not null,
    video_id         varchar(100),
    start_seconds    int,
    title            varchar(200),
    transcript       varchar(100000),
    transcript_shown boolean       not null,
    constraint ck_lesson_plan_videos_provider check (provider in ('YOUTUBE', 'RUTUBE', 'VK', 'OTHER'))
);

create index ix_lesson_plan_videos_plan on lesson_plan_videos (plan_id, position);
