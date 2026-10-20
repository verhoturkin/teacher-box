-- The cover of a PDF textbook: its first page as a thumbnail, a file of the textbooks namespace in FileStorage,
-- made on upload (or on the first request for a textbook uploaded before). Empty until then.

alter table textbooks add column cover_key varchar(36);
