/**
 * Schedule: lessons and weekly series, students' requests to move or cancel a lesson, reminders
 * and calendar feeds; the lesson plan of a lesson (a working plan of {@code textbooks}, roadmap 11).
 */
@ApplicationModule(displayName = "Schedule", allowedDependencies = {"shared", "identity :: api", "meetings :: api", "textbooks :: api"})
@NullMarked
package ru.teacherbox.schedule;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
