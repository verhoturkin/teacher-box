/**
 * Notifications: personal area inbox and delivery to messengers (Telegram, VK, MAX).
 * The modules write their notices themselves ({@code shared.notice}, ADR-0061); this module listens to
 * them and knows no module but {@code identity} (the recipients and their languages).
 */
@ApplicationModule(displayName = "Notifications",
        allowedDependencies = {"shared", "identity :: api"})
@NullMarked
package ru.teacherbox.notifications;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
