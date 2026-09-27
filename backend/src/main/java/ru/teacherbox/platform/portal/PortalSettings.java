package ru.teacherbox.platform.portal;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

/**
 * What the teacher (or the administrator) set; {@code null} means the default.
 *
 * @param name             name of the portal
 * @param address          address of the portal in its canonical form
 * @param setupCompletedAt when the teacher finished or skipped the first setup
 */
public record PortalSettings(@Nullable String name, @Nullable String address, @Nullable Instant setupCompletedAt,
        @Nullable Instant updatedAt, long version) {

    public static final int MAX_NAME_LENGTH = 60;
}
