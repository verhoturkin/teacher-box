package ru.teacherbox.identity.domain;

import org.jspecify.annotations.Nullable;

/**
 * The colour the teacher gives a student or a group to find them in lists at a glance. The interface paints it from
 * a fixed palette of M3 custom colours; the server only keeps the name.
 */
public enum LabelColor {
    RED, ORANGE, YELLOW, LIME, GREEN, CYAN, BLUE, VIOLET, PURPLE, PINK;

    /** The stored name; {@code null}: no colour. */
    public static @Nullable String nameOf(@Nullable LabelColor color) {
        return color == null ? null : color.name();
    }

    /** The colour of a stored name; {@code null}: no colour. */
    public static @Nullable LabelColor ofName(@Nullable String name) {
        return name == null ? null : valueOf(name);
    }
}
