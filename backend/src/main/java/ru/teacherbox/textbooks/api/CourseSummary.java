package ru.teacherbox.textbooks.api;

import java.util.UUID;

/** A course as other modules see it (ADR-0071). */
public record CourseSummary(UUID id, String name) {
}
