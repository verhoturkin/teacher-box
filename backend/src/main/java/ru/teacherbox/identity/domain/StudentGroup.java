package ru.teacherbox.identity.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A group of students taught together. A student may be in several groups; an archived group
 * keeps its members but is no longer offered for new lessons.
 */
public final class StudentGroup {

    public static final int MAX_NAME_LENGTH = 100;
    public static final int MAX_MEMBERS = 100;

    /** Who joined and who left the group in one change of its members. */
    public record MembersChange(List<UUID> added, List<UUID> removed) {

        public boolean isEmpty() {
            return added.isEmpty() && removed.isEmpty();
        }
    }

    private final UUID id;
    private String name;
    private final Set<UUID> memberIds;
    private @Nullable Instant archivedAt;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;

    private StudentGroup(UUID id, String name, Collection<UUID> memberIds, @Nullable Instant archivedAt,
            Instant createdAt, Instant updatedAt, long version) {
        this.id = Objects.requireNonNull(id);
        this.name = Objects.requireNonNull(name);
        this.memberIds = new LinkedHashSet<>(memberIds);
        this.archivedAt = archivedAt;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
    }

    public static StudentGroup create(UUID id, String name, Collection<UUID> memberIds, Instant now) {
        return new StudentGroup(id, validName(name), validMembers(memberIds), null, now, now, 0);
    }

    public static StudentGroup restore(UUID id, String name, Collection<UUID> memberIds, @Nullable Instant archivedAt,
            Instant createdAt, Instant updatedAt, long version) {
        return new StudentGroup(id, name, memberIds, archivedAt, createdAt, updatedAt, version);
    }

    /** @return {@code true} if the name changed */
    public boolean rename(String newName, Instant now) {
        String valid = validName(newName);
        if (valid.equals(name)) {
            return false;
        }
        name = valid;
        updatedAt = now;
        return true;
    }

    /** Replaces the members; the order of the new list is kept. */
    public MembersChange changeMembers(Collection<UUID> newMemberIds, Instant now) {
        Set<UUID> valid = validMembers(newMemberIds);
        List<UUID> added = new ArrayList<>(valid);
        added.removeAll(memberIds);
        List<UUID> removed = new ArrayList<>(memberIds);
        removed.removeAll(valid);
        if (!List.copyOf(valid).equals(List.copyOf(memberIds))) {
            memberIds.clear();
            memberIds.addAll(valid);
            updatedAt = now;
        }
        return new MembersChange(List.copyOf(added), List.copyOf(removed));
    }

    /** @return {@code true} if the student was a member */
    public boolean removeMember(UUID studentId, Instant now) {
        boolean removed = memberIds.remove(studentId);
        if (removed) {
            updatedAt = now;
        }
        return removed;
    }

    public void archive(Instant now) {
        if (isArchived()) {
            throw new BusinessRuleException("group.archived", "The group is already archived");
        }
        archivedAt = now;
        updatedAt = now;
    }

    public void unarchive(Instant now) {
        if (!isArchived()) {
            throw new BusinessRuleException("group.not-archived", "The group is not archived");
        }
        archivedAt = null;
        updatedAt = now;
    }

    /** Called by the repository after the group has been saved with a new version. */
    public void markSaved(long newVersion) {
        version = newVersion;
    }

    private static String validName(String name) {
        String trimmed = name.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_NAME_LENGTH) {
            throw new BusinessRuleException("group.name-invalid", "Group name must be 1-" + MAX_NAME_LENGTH
                    + " characters long");
        }
        return trimmed;
    }

    private static Set<UUID> validMembers(Collection<UUID> memberIds) {
        Set<UUID> unique = new LinkedHashSet<>(memberIds);
        if (unique.size() > MAX_MEMBERS) {
            throw new BusinessRuleException("group.too-many-members", "A group can have at most " + MAX_MEMBERS
                    + " students");
        }
        return unique;
    }

    public UUID id() {
        return id;
    }

    public String name() {
        return name;
    }

    public List<UUID> memberIds() {
        return List.copyOf(memberIds);
    }

    public boolean isArchived() {
        return archivedAt != null;
    }

    public @Nullable Instant archivedAt() {
        return archivedAt;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public long version() {
        return version;
    }
}
