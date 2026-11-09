package ru.teacherbox.shared.settings;

import java.util.Set;

/**
 * A module keeps some of the teacher's settings that used to be variables of {@code .env} (ADR-0056) and
 * takes their old values once (SPI): {@code platform} collects the beans and calls them on the first start
 * of the version that moved the variables, before the modules start using the settings, and never again for
 * the same variables.
 */
public interface TeacherSettingsImport {

    /** The variables the module takes, e.g. {@code TEACHERBOX_SCHEDULE_REMINDERS}. */
    Set<String> names();

    /**
     * Stores each old value unless the module already keeps its own setting (the teacher's choice wins);
     * an invalid value is left out. Must not depend on the order of the modules.
     *
     * @param values the values still set, only for {@link #names()}
     * @return the variables whose values were stored
     */
    Set<String> importFrom(OldSettings values);
}
