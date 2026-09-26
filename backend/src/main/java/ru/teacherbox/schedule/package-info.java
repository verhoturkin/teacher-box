/**
 * Schedule: lessons and weekly series, students' requests to move or cancel a lesson, reminders
 * and calendar feeds.
 */
@ApplicationModule(displayName = "Schedule", allowedDependencies = {"shared", "identity :: api"})
@NullMarked
package ru.teacherbox.schedule;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
