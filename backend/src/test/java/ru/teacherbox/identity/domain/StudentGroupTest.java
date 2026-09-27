package ru.teacherbox.identity.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import ru.teacherbox.identity.domain.StudentGroup.MembersChange;
import ru.teacherbox.shared.error.BusinessRuleException;

class StudentGroupTest {

    private static final Instant NOW = Instant.parse("2026-09-01T10:00:00Z");
    private static final UUID ANNA = UUID.randomUUID();
    private static final UUID BORIS = UUID.randomUUID();
    private static final UUID VERA = UUID.randomUUID();

    @Test
    void createsWithTrimmedNameAndUniqueMembers() {
        StudentGroup group = StudentGroup.create(UUID.randomUUID(), "  ОГЭ 9 класс ", List.of(ANNA, BORIS, ANNA), NOW);

        assertThat(group.name()).isEqualTo("ОГЭ 9 класс");
        assertThat(group.memberIds()).containsExactly(ANNA, BORIS);
        assertThat(group.isArchived()).isFalse();
        assertThat(group.archivedAt()).isNull();
        assertThat(group.createdAt()).isEqualTo(NOW);
        assertThat(group.updatedAt()).isEqualTo(NOW);
        assertThat(group.version()).isZero();
    }

    @Test
    void validatesNameAndSize() {
        assertThatThrownBy(() -> StudentGroup.create(UUID.randomUUID(), " ", List.of(), NOW))
                .isInstanceOf(BusinessRuleException.class).hasFieldOrPropertyWithValue("code", "group.name-invalid");
        assertThatThrownBy(() -> StudentGroup.create(UUID.randomUUID(), "x".repeat(101), List.of(), NOW))
                .isInstanceOf(BusinessRuleException.class).hasFieldOrPropertyWithValue("code", "group.name-invalid");
        List<UUID> tooMany = IntStream.rangeClosed(0, StudentGroup.MAX_MEMBERS).mapToObj(i -> UUID.randomUUID())
                .toList();
        assertThatThrownBy(() -> StudentGroup.create(UUID.randomUUID(), "Большая", tooMany, NOW))
                .isInstanceOf(BusinessRuleException.class)
                .hasFieldOrPropertyWithValue("code", "group.too-many-members");
    }

    @Test
    void renamesOnlyWhenTheNameChanges() {
        StudentGroup group = StudentGroup.create(UUID.randomUUID(), "Группа", List.of(), NOW);

        assertThat(group.rename(" Группа ", NOW.plusSeconds(1))).isFalse();
        assertThat(group.updatedAt()).isEqualTo(NOW);
        assertThat(group.rename("Новая", NOW.plusSeconds(2))).isTrue();
        assertThat(group.name()).isEqualTo("Новая");
        assertThat(group.updatedAt()).isEqualTo(NOW.plusSeconds(2));
    }

    @Test
    void changesMembersAndReportsWhoJoinedAndLeft() {
        StudentGroup group = StudentGroup.create(UUID.randomUUID(), "Группа", List.of(ANNA, BORIS), NOW);

        MembersChange change = group.changeMembers(List.of(BORIS, VERA), NOW.plusSeconds(1));

        assertThat(change.added()).containsExactly(VERA);
        assertThat(change.removed()).containsExactly(ANNA);
        assertThat(change.isEmpty()).isFalse();
        assertThat(group.memberIds()).containsExactly(BORIS, VERA);
        assertThat(group.updatedAt()).isEqualTo(NOW.plusSeconds(1));
    }

    @Test
    void reorderingIsAChangeWithoutNewcomers() {
        StudentGroup group = StudentGroup.create(UUID.randomUUID(), "Группа", List.of(ANNA, BORIS), NOW);

        assertThat(group.changeMembers(List.of(ANNA, BORIS), NOW.plusSeconds(1)).isEmpty()).isTrue();
        assertThat(group.updatedAt()).isEqualTo(NOW);

        MembersChange change = group.changeMembers(List.of(BORIS, ANNA), NOW.plusSeconds(2));
        assertThat(change.isEmpty()).isTrue();
        assertThat(group.memberIds()).containsExactly(BORIS, ANNA);
        assertThat(group.updatedAt()).isEqualTo(NOW.plusSeconds(2));
    }

    @Test
    void removesAMember() {
        StudentGroup group = StudentGroup.create(UUID.randomUUID(), "Группа", List.of(ANNA, BORIS), NOW);

        assertThat(group.removeMember(VERA, NOW.plusSeconds(1))).isFalse();
        assertThat(group.updatedAt()).isEqualTo(NOW);
        assertThat(group.removeMember(ANNA, NOW.plusSeconds(2))).isTrue();
        assertThat(group.memberIds()).containsExactly(BORIS);
        assertThat(group.updatedAt()).isEqualTo(NOW.plusSeconds(2));
    }

    @Test
    void archivesAndRestores() {
        StudentGroup group = StudentGroup.create(UUID.randomUUID(), "Группа", Collections.emptyList(), NOW);

        assertThatThrownBy(() -> group.unarchive(NOW)).isInstanceOf(BusinessRuleException.class)
                .hasFieldOrPropertyWithValue("code", "group.not-archived");
        group.archive(NOW.plusSeconds(1));
        assertThat(group.isArchived()).isTrue();
        assertThat(group.archivedAt()).isEqualTo(NOW.plusSeconds(1));
        assertThatThrownBy(() -> group.archive(NOW)).isInstanceOf(BusinessRuleException.class)
                .hasFieldOrPropertyWithValue("code", "group.archived");
        group.unarchive(NOW.plusSeconds(2));
        assertThat(group.isArchived()).isFalse();
        assertThat(group.updatedAt()).isEqualTo(NOW.plusSeconds(2));
    }
}
