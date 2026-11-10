-- The instance currency as the teacher set it (ADR-0056), an ISO 4217 code; empty: TEACHERBOX_BILLING_CURRENCY
-- until 363.4 reads it.
alter table billing.settings add column currency varchar(3);
