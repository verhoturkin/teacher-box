/**
 * Settings that apply without a restart (ADR-0056): the event {@link ru.teacherbox.shared.settings.SettingsChanged}
 * and {@link ru.teacherbox.shared.settings.LiveProperties}, which binds a module's properties on every call; the
 * one-time import of the teacher's old {@code .env} values (SPI
 * {@link ru.teacherbox.shared.settings.TeacherSettingsImport}).
 */
@NullMarked
package ru.teacherbox.shared.settings;

import org.jspecify.annotations.NullMarked;
