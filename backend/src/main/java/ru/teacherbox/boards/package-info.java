/**
 * Boards (ADR-0028): our own Excalidraw boards (scene, images and copies in the portal) and external
 * boards by link, bound to any number of students and groups.
 */
@ApplicationModule(displayName = "Boards", allowedDependencies = {"shared", "identity :: api"})
@NullMarked
package ru.teacherbox.boards;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
