package ru.teacherbox.homework.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;

class HomeworkDomainTest {

    private static final Instant NOW = Instant.parse("2026-09-01T10:00:00Z");

    @Test
    void assignmentValidationAndUpdate() {
        Assignment assignment = Assignment.create(UUID.randomUUID(), AssignmentKind.WRITTEN, "  Дроби  ",
                "  Решить №1-5  ", null, null, NOW);
        assertThat(assignment.title()).isEqualTo("Дроби");
        assertThat(assignment.description()).isEqualTo("Решить №1-5");

        assignment.update("Дроби 2", " ", "<p>ignored</p>", NOW.plusSeconds(3600), NOW.plusSeconds(1));
        assignment.markSaved(2);

        assertThat(assignment.description()).isNull();
        assertThat(assignment.interactiveHtml()).as("only interactive homework keeps HTML").isNull();
        assertThat(assignment.dueAt()).isEqualTo(NOW.plusSeconds(3600));
        assertThat(assignment.updatedAt()).isEqualTo(NOW.plusSeconds(1));
        assertThat(assignment.version()).isEqualTo(2);
        assertThat(assignment.allowsMaterials()).isTrue();
        assertThatThrownBy(() -> assignment.update(" ", null, null, null, NOW)).hasMessageContaining("Title");
        assertThatThrownBy(() -> Assignment.create(UUID.randomUUID(), AssignmentKind.WRITTEN, "x".repeat(201), null,
                null, null, NOW)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> Assignment.create(UUID.randomUUID(), AssignmentKind.WRITTEN, "t",
                "x".repeat(20_001), null, null, NOW)).hasMessageContaining("too long");
    }

    @Test
    void interactiveAssignmentKeepsItsHtml() {
        Assignment assignment = Assignment.create(UUID.randomUUID(), AssignmentKind.INTERACTIVE, "Тест", null,
                "<p>?</p>\n", null, NOW);

        assertThat(assignment.interactiveHtml()).isEqualTo("<p>?</p>\n");
        assertThat(assignment.allowsMaterials()).isFalse();
        assertThatThrownBy(() -> assignment.update("Тест", null, "  ", null, NOW))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("HTML");
        assertThatThrownBy(() -> Assignment.create(UUID.randomUUID(), AssignmentKind.INTERACTIVE, "Тест", null,
                "x".repeat(Assignment.MAX_HTML + 1), null, NOW)).hasMessageContaining("too long");
        assertThat(Assignment.create(UUID.randomUUID(), AssignmentKind.BOARD, "Доска", null, null, null, NOW)
                .allowsMaterials()).isFalse();
    }

    @Test
    void interactiveResultLimits() {
        var answer = new InteractiveResult.Answer("2 + 2", "4", true);
        assertThat(new InteractiveResult(null, null, List.of(answer)).answers()).containsExactly(answer);
        assertThat(new InteractiveResult(0, 1, List.of()).score()).isZero();

        assertThatThrownBy(() -> new InteractiveResult(1, null, List.of())).as("a score needs its maximum")
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("not valid");
        assertThatThrownBy(() -> new InteractiveResult(-1, 3, List.of())).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> new InteractiveResult(null, 0, List.of())).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> new InteractiveResult(null, InteractiveResult.MAX_SCORE + 1, List.of()))
                .isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> new InteractiveResult(null, null,
                Collections.nCopies(InteractiveResult.MAX_ANSWERS + 1, answer)))
                .isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> new InteractiveResult.Answer(" ", null, null))
                .isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> new InteractiveResult.Answer("q".repeat(InteractiveResult.MAX_QUESTION + 1), null,
                null)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> new InteractiveResult.Answer("q", "a".repeat(InteractiveResult.MAX_ANSWER + 1),
                null)).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void taskLifecycle() {
        HomeworkTask task = HomeworkTask.assign(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), NOW);
        assertThat(task.status()).isEqualTo(TaskStatus.ASSIGNED);

        task.submit(NOW.plusSeconds(1));
        task.submit(NOW.plusSeconds(2));
        assertThat(task.status()).isEqualTo(TaskStatus.SUBMITTED);
        assertThat(task.submittedAt()).isEqualTo(NOW.plusSeconds(2));

        task.returnForRevision("  Исправь №3 ", NOW.plusSeconds(3));
        assertThat(task.status()).isEqualTo(TaskStatus.RETURNED);
        assertThat(task.teacherComment()).isEqualTo("Исправь №3");

        task.submit(NOW.plusSeconds(4));
        task.accept(" 5 ", " ", NOW.plusSeconds(5));
        assertThat(task.status()).isEqualTo(TaskStatus.ACCEPTED);
        assertThat(task.grade()).isEqualTo("5");
        assertThat(task.teacherComment()).isNull();
        assertThat(task.reviewedAt()).isEqualTo(NOW.plusSeconds(5));
        assertThatThrownBy(() -> task.submit(NOW)).hasMessageContaining("already been accepted");

        task.returnForRevision(null, NOW.plusSeconds(6));
        assertThat(task.status()).isEqualTo(TaskStatus.RETURNED);
        assertThat(task.grade()).isNull();
    }

    @Test
    void reviewRequiresSubmission() {
        HomeworkTask task = HomeworkTask.assign(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), NOW);

        assertThatThrownBy(() -> task.accept("5", null, NOW))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(e -> ((BusinessRuleException) e).code()).isEqualTo("task.not-submitted");
        assertThatThrownBy(() -> task.returnForRevision(null, NOW)).hasMessageContaining("returned");

        task.submit(NOW);
        assertThatThrownBy(() -> task.accept("x".repeat(21), null, NOW)).hasMessageContaining("Grade");
        assertThatThrownBy(() -> task.accept(null, "c".repeat(5_001), NOW)).hasMessageContaining("Comment");
        assertThatThrownBy(() -> task.returnForRevision("c".repeat(5_001), NOW)).hasMessageContaining("Comment");
        // A rejected review changes nothing.
        assertThat(task.status()).isEqualTo(TaskStatus.SUBMITTED);
        assertThat(task.reviewedAt()).isNull();
    }

    @Test
    void overdueOnlyForOpenTasksAfterDeadline() {
        HomeworkTask task = HomeworkTask.assign(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), NOW);
        Instant due = NOW.plusSeconds(60);

        assertThat(task.isOverdue(null, NOW.plusSeconds(3600))).isFalse();
        assertThat(task.isOverdue(due, NOW)).isFalse();
        assertThat(task.isOverdue(due, NOW.plusSeconds(61))).isTrue();

        task.submit(NOW);
        assertThat(task.isOverdue(due, NOW.plusSeconds(61))).isFalse();

        task.markDueReminderSent(NOW);
        task.markSaved(4);
        assertThat(task.dueReminderSentAt()).isEqualTo(NOW);
        assertThat(task.version()).isEqualTo(4);
    }

    @Test
    void submissionNeedsTextOrFiles() {
        UUID taskId = UUID.randomUUID();

        assertThat(Submission.create(UUID.randomUUID(), taskId, "  ответ ", false, NOW).text()).isEqualTo("ответ");
        assertThat(Submission.create(UUID.randomUUID(), taskId, " ", true, NOW).text()).isNull();
        assertThatThrownBy(() -> Submission.create(UUID.randomUUID(), taskId, null, false, NOW))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(e -> ((BusinessRuleException) e).code()).isEqualTo("submission.empty");
        assertThatThrownBy(() -> Submission.create(UUID.randomUUID(), taskId, "x".repeat(20_001), false, NOW))
                .hasMessageContaining("too long");
    }

    @Test
    void filePolicy() {
        assertThat(FilePolicy.contentTypeOf("Решение.PDF")).isEqualTo("application/pdf");
        assertThat(FilePolicy.contentTypeOf("photo.jpeg")).isEqualTo("image/jpeg");
        assertThatThrownBy(() -> FilePolicy.contentTypeOf("script.exe")).hasMessageContaining("exe");
        assertThatThrownBy(() -> FilePolicy.contentTypeOf("noextension")).hasMessageContaining("no extension");

        assertThat(FilePolicy.cleanFilename("C:\\Users\\me\\hw.docx")).isEqualTo("hw.docx");
        assertThat(FilePolicy.cleanFilename("../../etc/passwd.txt")).isEqualTo("passwd.txt");
        assertThat(FilePolicy.cleanFilename("a\u0000b.txt")).isEqualTo("ab.txt");
        assertThat(FilePolicy.cleanFilename("x".repeat(300) + ".pdf")).hasSize(255).endsWith(".pdf");
        assertThat(FilePolicy.cleanFilename("y".repeat(300))).hasSize(255);
        assertThatThrownBy(() -> FilePolicy.cleanFilename("dir/..")).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> FilePolicy.cleanFilename("  ")).isInstanceOf(BusinessRuleException.class);
        assertThatCode(() -> FilePolicy.cleanFilename("ok.png")).doesNotThrowAnyException();
    }
}
