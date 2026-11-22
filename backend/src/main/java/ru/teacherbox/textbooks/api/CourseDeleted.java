package ru.teacherbox.textbooks.api;

import java.util.UUID;

/**
 * The teacher deleted a course (ADR-0071): its textbooks, students and groups are without a course already;
 * other modules clear their own links to it.
 */
public record CourseDeleted(UUID courseId) {
}
