-- Version 1.5: the way a payment was made is not recorded any more.
alter table billing.payments drop constraint ck_payments_method;
alter table billing.payments drop column method;
