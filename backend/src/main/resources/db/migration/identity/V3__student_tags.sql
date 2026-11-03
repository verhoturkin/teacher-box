-- Student tags (ADR-0055): the teacher's tags with ordered values and at most one value of a tag per student.
create table tags (
    id        uuid        primary key,
    name      varchar(60) not null,
    use_in_ai boolean     not null,
    position  integer     not null,
    version   bigint      not null
);

create table tag_values (
    id       uuid        primary key,
    tag_id   uuid        not null,
    label    varchar(40) not null,
    position integer     not null,
    constraint fk_tag_values_tag foreign key (tag_id) references tags (id)
);

create index ix_tag_values_tag on tag_values (tag_id);

create table student_tags (
    student_id uuid not null,
    tag_id     uuid not null,
    value_id   uuid not null,
    constraint pk_student_tags primary key (student_id, tag_id),
    constraint fk_student_tags_student foreign key (student_id) references users (id),
    constraint fk_student_tags_tag foreign key (tag_id) references tags (id),
    constraint fk_student_tags_value foreign key (value_id) references tag_values (id)
);

create index ix_student_tags_value on student_tags (value_id);
