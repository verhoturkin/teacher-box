-- What the page of an interactive assignment reported (ADR-0040): JSON {score, maxScore, answers}; null otherwise.

alter table submissions add column result character large object;
