package ru.teacherbox.identity.application;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.domain.Tag;
import ru.teacherbox.identity.persistence.TagRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/** The teacher's student tags (ADR-0055); teacher-only data, never offered to students or other modules. */
@Service
public class StudentTagService {

    /** A value in a request: {@code id} of a kept value, or none for a new one. */
    public record ValueInput(@Nullable UUID id, String label) {
    }

    /** A changed tag and how many students lost a value removed from it. */
    public record Changed(Tag tag, int clearedStudents) {
    }

    private final TagRepository tags;

    public StudentTagService(TagRepository tags) {
        this.tags = tags;
    }

    @Transactional(readOnly = true)
    public List<Tag> list() {
        return tags.findAll();
    }

    @Transactional
    public Tag create(String name, boolean useInAi, List<String> labels) {
        List<Tag> all = tags.findAll();
        if (all.size() >= Tag.MAX_TAGS) {
            throw new BusinessRuleException("tag.limit", "No more than 30 tags");
        }
        Tag tag = new Tag(Ids.newId(), name, useInAi,
                labels.stream().map(label -> new Tag.Value(Ids.newId(), label)).toList(), 0);
        requireUniqueName(all, tag);
        tags.insert(tag);
        return tag;
    }

    /**
     * Renames the tag, sets the AI flag and replaces its values in the given order: a value with an id keeps it
     * (and the students who have it), a value without one is new, a missing value is cleared from the students.
     *
     * @throws OptimisticLockingFailureException if the tag was changed after {@code expectedVersion}
     */
    @Transactional
    public Changed update(UUID tagId, String name, boolean useInAi, List<ValueInput> values, long expectedVersion) {
        List<Tag> all = tags.findAll();
        Tag current = find(all, tagId);
        if (current.version() != expectedVersion) {
            throw new OptimisticLockingFailureException("Tag " + tagId + " was modified");
        }
        Set<UUID> known = new HashSet<>(current.values().stream().map(Tag.Value::id).toList());
        List<Tag.Value> next = values.stream().map(value -> {
            UUID id = value.id();
            if (id != null && !known.contains(id)) {
                throw new BusinessRuleException("tag.value-unknown", "The value does not belong to the tag");
            }
            return new Tag.Value(id == null ? Ids.newId() : id, value.label());
        }).toList();
        Tag tag = new Tag(tagId, name, useInAi, next, expectedVersion);
        requireUniqueName(all, tag);
        int cleared = tags.update(tag);
        return new Changed(new Tag(tagId, tag.name(), useInAi, tag.values(), expectedVersion + 1), cleared);
    }

    /** @return how many students had a value of the tag */
    @Transactional
    public int delete(UUID tagId) {
        find(tags.findAll(), tagId);
        return tags.delete(tagId);
    }

    /** Puts all tags in the given order; the list names every tag once. */
    @Transactional
    public List<Tag> reorder(List<UUID> ids) {
        Set<UUID> existing = new HashSet<>(tags.findAll().stream().map(Tag::id).toList());
        if (ids.size() != existing.size() || !existing.equals(new HashSet<>(ids))) {
            throw new BusinessRuleException("tag.order-invalid", "The order must list every tag once");
        }
        tags.reorder(ids);
        return tags.findAll();
    }

    private static Tag find(List<Tag> all, UUID tagId) {
        return all.stream().filter(tag -> tag.id().equals(tagId)).findFirst()
                .orElseThrow(() -> new NotFoundException("tag.not-found", "Tag not found"));
    }

    private static void requireUniqueName(List<Tag> all, Tag tag) {
        if (all.stream().anyMatch(other -> !other.id().equals(tag.id()) && other.sameName(tag.name()))) {
            throw new BusinessRuleException("tag.name-taken", "A tag with this name already exists");
        }
    }
}
