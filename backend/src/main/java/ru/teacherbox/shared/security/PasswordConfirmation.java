package ru.teacherbox.shared.security;

import java.util.UUID;

/**
 * Confirms a dangerous action (restoring a backup, a full reset) with the password of the user who
 * asks for it (ADR-0014). Implemented by the identity module, used by the platform, which knows
 * nothing about users.
 */
public interface PasswordConfirmation {

    /** @return whether the password is the current password of the active user */
    boolean matches(UUID userId, String password);
}
