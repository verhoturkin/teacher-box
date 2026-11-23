package ru.teacherbox.schedule.api;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * The lessons of a period as other modules read them (ADR-0072): the facts the teacher marked, no private notes.
 */
public interface LessonJournal {

    /**
     * The lessons of the student, alone or with a group and whatever the outcome, that start on the days
     * {@code [from, to]} of the instance time zone, oldest first; an unknown student has none.
     *
     * @throws ru.teacherbox.shared.error.BusinessRuleException {@code schedule.range-invalid} if {@code to} is
     *                                                          before {@code from} or the period is too long
     */
    List<JournalLesson> ofStudent(UUID studentId, LocalDate from, LocalDate to);
}
