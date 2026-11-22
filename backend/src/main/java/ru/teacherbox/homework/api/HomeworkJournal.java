package ru.teacherbox.homework.api;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** A student's homework of a period as other modules read it (ADR-0072). */
public interface HomeworkJournal {

    /**
     * The tasks given to the student on the days {@code [from, to]} of the instance time zone, oldest first; an
     * unknown student has none.
     *
     * @throws ru.teacherbox.shared.error.BusinessRuleException {@code homework.range-invalid} if {@code to} is
     *                                                          before {@code from}
     */
    List<JournalTask> ofStudent(UUID studentId, LocalDate from, LocalDate to);
}
