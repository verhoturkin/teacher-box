-- The teacher no longer sends the lesson summary (469.3): its notices, their deliveries and the muted
-- topic LESSON_SUMMARY go.
delete from deliveries where notification_id in (select id from inbox where kind = 'LESSON_SUMMARY');
delete from inbox where kind = 'LESSON_SUMMARY';
update preferences
   set muted_topics = trim(both ',' from replace(',' || muted_topics || ',', ',LESSON_SUMMARY,', ','))
 where ',' || muted_topics || ',' like '%,LESSON_SUMMARY,%';
