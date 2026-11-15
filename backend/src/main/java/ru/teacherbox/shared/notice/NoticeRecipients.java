package ru.teacherbox.shared.notice;

import java.util.Optional;
import java.util.UUID;

/**
 * Who receives a notice of a part of the portal that knows no users: the platform tells the teacher
 * that a backup failed (ADR-0061). Implemented by the identity module.
 */
public interface NoticeRecipients {

    /** @return the teacher of the instance; empty until the account is created on the first start */
    Optional<UUID> teacher();
}
