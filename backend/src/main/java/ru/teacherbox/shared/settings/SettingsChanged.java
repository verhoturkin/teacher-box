package ru.teacherbox.shared.settings;

import java.util.Set;

/**
 * Settings changed in the running portal and are already in force (ADR-0056). A consumer that keeps
 * something built from a setting (a client, a schedule) rebuilds it; one that reads the setting through
 * {@link LiveProperties} on every call needs nothing.
 *
 * @param names the variable names, e.g. {@code TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS}
 */
public record SettingsChanged(Set<String> names) {

    public SettingsChanged {
        names = Set.copyOf(names);
    }

    /** Whether any of the changed variables starts with the prefix, e.g. {@code TEACHERBOX_BACKUP_}. */
    public boolean touches(String prefix) {
        return names.stream().anyMatch(name -> name.startsWith(prefix));
    }
}
