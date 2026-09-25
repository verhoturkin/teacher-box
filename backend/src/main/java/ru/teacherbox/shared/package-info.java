/**
 * Shared kernel: value types and cross-cutting contracts available to every module.
 * Must stay small and free of business logic.
 */
@ApplicationModule(displayName = "Shared kernel", type = ApplicationModule.Type.OPEN)
@NullMarked
package ru.teacherbox.shared;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
