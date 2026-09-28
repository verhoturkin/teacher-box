package ru.teacherbox.platform.portal;

import java.util.Locale;
import java.util.Optional;

/**
 * Colors of the portal the teacher chooses from (ADR-0015): palettes of the PrimeNG theme that keep
 * the contrast of buttons and links in the light and the dark theme.
 */
public enum PortalAccent {
    INDIGO,
    BLUE,
    TEAL,
    EMERALD,
    VIOLET,
    PINK;

    public static final PortalAccent DEFAULT = INDIGO;

    /** @return the color by its name in any case, e.g. {@code emerald} */
    public static Optional<PortalAccent> parse(String value) {
        try {
            return Optional.of(valueOf(value.strip().toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /** The name of the PrimeNG palette, e.g. {@code emerald}. */
    public String palette() {
        return name().toLowerCase(Locale.ROOT);
    }
}
