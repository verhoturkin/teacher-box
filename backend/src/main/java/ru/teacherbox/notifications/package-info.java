/**
 * Notifications: personal area inbox and delivery to messengers (Telegram, VK, MAX).
 * Listens to events of other modules and never calls their services.
 */
@ApplicationModule(displayName = "Notifications",
        allowedDependencies = {"shared", "identity :: api", "billing :: api", "homework :: api",
                "schedule :: api"})
@NullMarked
package ru.teacherbox.notifications;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
