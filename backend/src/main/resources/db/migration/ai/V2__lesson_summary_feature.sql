-- The assistant also drafts lesson summaries (0.37.0).
alter table system_prompts drop constraint ck_system_prompts_feature;
alter table system_prompts add constraint ck_system_prompts_feature
    check (feature in ('HOMEWORK_DRAFT', 'REVIEW_DRAFT', 'LESSON_SUMMARY'));
