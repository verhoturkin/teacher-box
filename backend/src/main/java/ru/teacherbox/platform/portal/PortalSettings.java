package ru.teacherbox.platform.portal;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

/**
 * What the teacher (or the administrator) set; {@code null} means the default.
 *
 * @param name             name of the portal
 * @param address          address of the portal in its canonical form
 * @param accent           color of the portal (ADR-0015)
 * @param logo             the portal's own logo
 * @param setupCompletedAt when the teacher finished or skipped the first setup
 */
public record PortalSettings(@Nullable String name, @Nullable String address, @Nullable PortalAccent accent,
        @Nullable Logo logo, @Nullable Instant setupCompletedAt, @Nullable Instant updatedAt, long version) {

    public static final int MAX_NAME_LENGTH = 60;

    /**
     * @param key         key of the file in the storage namespace {@code platform}
     * @param contentType e.g. {@code image/png}
     */
    public record Logo(String key, String contentType) {
    }

    PortalSettings withNameAndAddress(@Nullable String newName, @Nullable String newAddress, Instant now) {
        return new PortalSettings(newName, newAddress, accent, logo, setupCompletedAt, now, version);
    }

    PortalSettings withAccent(@Nullable PortalAccent newAccent, Instant now) {
        return new PortalSettings(name, address, newAccent, logo, setupCompletedAt, now, version);
    }

    PortalSettings withLogo(@Nullable Logo newLogo, Instant now) {
        return new PortalSettings(name, address, accent, newLogo, setupCompletedAt, now, version);
    }

    PortalSettings setupCompleted(Instant now) {
        return new PortalSettings(name, address, accent, logo, now, now, version);
    }
}
