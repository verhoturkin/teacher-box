package ru.teacherbox.notifications.domain;

import java.util.EnumSet;
import java.util.Set;

/**
 * Which of a child's notices a guardian gets (ADR-0069): a category switched off reaches neither the inbox nor
 * the messengers. Quiet hours and muted topics in messengers are the guardian's ordinary {@link Preferences}.
 */
public record GuardianPreferences(Set<GuardianCategory> off) {

    /** All four categories on. */
    public static final GuardianPreferences DEFAULT = new GuardianPreferences(Set.of());

    public GuardianPreferences {
        EnumSet<GuardianCategory> copy = EnumSet.noneOf(GuardianCategory.class);
        copy.addAll(off);
        off = Set.copyOf(copy);
    }

    public boolean receives(GuardianCategory category) {
        return !off.contains(category);
    }
}
