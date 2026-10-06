/**
 * Meetings: video calls of students and groups — external links entered by the teacher (ADR-0012, ADR-0030).
 */
@ApplicationModule(displayName = "Meetings", allowedDependencies = {"shared", "identity :: api"})
@NullMarked
package ru.teacherbox.meetings;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
