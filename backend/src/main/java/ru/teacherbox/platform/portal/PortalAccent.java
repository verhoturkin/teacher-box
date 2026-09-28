package ru.teacherbox.platform.portal;

import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The color of the portal (ADR-0015): one of the PrimeNG palettes that keep the contrast of buttons
 * and links in both themes, or the teacher's own color {@code #rrggbb} (its shades are built in the
 * browser, which warns about a poor contrast).
 *
 * @param value the palette name, e.g. {@code emerald}, or the own color in lower case, e.g. {@code #1a7f5a}
 */
public record PortalAccent(String value) {

    /** The palettes to choose from. */
    public static final Set<String> PALETTES = Set.of("indigo", "blue", "teal", "emerald", "violet", "pink");

    public static final PortalAccent DEFAULT = new PortalAccent("indigo");

    private static final Pattern OWN = Pattern.compile("#[0-9a-f]{6}");

    /** @return the color by a palette name in any case ({@code EMERALD}) or {@code #rrggbb} */
    public static Optional<PortalAccent> parse(String text) {
        String value = text.strip().toLowerCase(Locale.ROOT);
        return PALETTES.contains(value) || OWN.matcher(value).matches()
                ? Optional.of(new PortalAccent(value))
                : Optional.empty();
    }

    /** The teacher chose their own color rather than a palette. */
    public boolean own() {
        return value.startsWith("#");
    }
}
