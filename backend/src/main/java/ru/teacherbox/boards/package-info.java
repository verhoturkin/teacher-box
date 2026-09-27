/**
 * Boards: links to the interactive boards (Holst) of students and groups (ADR-0012). Holst has no
 * server API for boards, so materials get there through the clipboard.
 */
@ApplicationModule(displayName = "Boards", allowedDependencies = {"shared", "identity :: api"})
@NullMarked
package ru.teacherbox.boards;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
