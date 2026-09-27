/**
 * Identity: authentication of the teacher and students, invitations, sessions (ADR-0003) and groups
 * of students (ADR-0011).
 */
@ApplicationModule(displayName = "Identity", allowedDependencies = "shared")
@NullMarked
package ru.teacherbox.identity;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
