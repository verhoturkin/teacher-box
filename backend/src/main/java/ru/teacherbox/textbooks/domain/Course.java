package ru.teacherbox.textbooks.domain;

import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A course (ADR-0071): a named programme, e.g. «Английский A2»; names are unique ignoring case.
 *
 * @param position the place in the teacher's list, from 0
 */
public record Course(UUID id, String name, int position, long version) {

    public static final int MAX_NAME = 100;

    public Course {
        Objects.requireNonNull(id);
        name = validName(name);
    }

    public Course renamed(String newName) {
        return new Course(id, newName, position, version);
    }

    private static String validName(@Nullable String value) {
        String name = value == null ? "" : value.strip();
        if (name.isEmpty() || name.length() > MAX_NAME) {
            throw new BusinessRuleException("textbooks.course-invalid",
                    "The course name must be 1-" + MAX_NAME + " characters");
        }
        return name;
    }
}
