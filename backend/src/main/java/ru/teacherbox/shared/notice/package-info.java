/**
 * Notices (ADR-0061): a module writes what a user has to learn — the texts in every language, the
 * kind and the link — and publishes {@link ru.teacherbox.shared.notice.NoticeRequested};
 * {@code notifications} listens to it and keeps the inbox, the preferences and the delivery without
 * knowing the modules.
 */
@NullMarked
package ru.teacherbox.shared.notice;

import org.jspecify.annotations.NullMarked;
