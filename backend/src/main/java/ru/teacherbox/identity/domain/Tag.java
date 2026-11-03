package ru.teacherbox.identity.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A student tag of the teacher (ADR-0055): a name and its ordered values; a student has at most one value
 * of a tag. Tags marked {@code useInAi} go to the AI drafts as defaults.
 */
public record Tag(UUID id, String name, Kind kind, boolean useInAi, List<Value> values, long version) {

    /** {@code LIST}: one of the tag's values; {@code TEXT}: free text (1 to 120 characters) per student. */
    public enum Kind {
        LIST, TEXT
    }

    public static final int MAX_TEXT_LENGTH = 120;

    public static final int MAX_TAGS = 30;
    public static final int MAX_NAME_LENGTH = 60;
    public static final int MAX_VALUES = 50;
    public static final int MAX_LABEL_LENGTH = 40;

    public record Value(UUID id, String label) {

        public Value {
            Objects.requireNonNull(id);
            label = label.strip();
            if (label.isEmpty() || label.length() > MAX_LABEL_LENGTH) {
                throw new BusinessRuleException("tag.value-invalid", "A value label has 1 to 40 characters");
            }
        }
    }

    public Tag {
        Objects.requireNonNull(id);
        Objects.requireNonNull(kind);
        name = name.strip();
        if (name.isEmpty() || name.length() > MAX_NAME_LENGTH) {
            throw new BusinessRuleException("tag.name-invalid", "A tag name has 1 to 60 characters");
        }
        values = List.copyOf(values);
        if (kind == Kind.TEXT ? !values.isEmpty() : values.isEmpty() || values.size() > MAX_VALUES) {
            throw new BusinessRuleException("tag.values-invalid", "A list tag has 1 to 50 values, a text tag none");
        }
        Set<String> labels = new HashSet<>();
        Set<UUID> ids = new HashSet<>();
        for (Value value : values) {
            if (!labels.add(value.label().toLowerCase(Locale.ROOT)) || !ids.add(value.id())) {
                throw new BusinessRuleException("tag.value-duplicate", "Values of a tag must differ");
            }
        }
    }

    public boolean sameName(String other) {
        return name.equalsIgnoreCase(other.strip());
    }
}
