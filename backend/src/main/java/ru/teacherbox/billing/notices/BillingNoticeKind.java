package ru.teacherbox.billing.notices;

import ru.teacherbox.shared.notice.NoticeKind;

/** What billing notifies about; the names are known to {@code notifications} (preferences, icons). */
enum BillingNoticeKind implements NoticeKind {
    LESSON_RECORDED,
    LESSON_CANCELLED,
    PAYMENT_RECORDED,
    PAYMENT_VOIDED
}
