/**
 * Meetings: permanent video rooms of students and groups in Yandex Telemost, created through its
 * API or entered by the teacher (ADR-0012).
 */
@ApplicationModule(displayName = "Meetings", allowedDependencies = {"shared", "identity :: api"})
@NullMarked
package ru.teacherbox.meetings;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
