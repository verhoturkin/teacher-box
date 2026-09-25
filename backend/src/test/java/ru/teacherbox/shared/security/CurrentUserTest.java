package ru.teacherbox.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.ForbiddenException;

class CurrentUserTest {

    private final UUID studentId = UUID.randomUUID();
    private final CurrentUser teacher = new CurrentUser(UUID.randomUUID(), Role.TEACHER, "Teacher");
    private final CurrentUser student = new CurrentUser(studentId, Role.STUDENT, "Student");

    @Test
    void teacherMayAccessAnyStudent() {
        assertThat(teacher.isTeacher()).isTrue();
        assertThatCode(() -> teacher.requireSelfOrTeacher(UUID.randomUUID())).doesNotThrowAnyException();
    }

    @Test
    void studentMayAccessOnlyThemself() {
        assertThat(student.isTeacher()).isFalse();
        assertThatCode(() -> student.requireSelfOrTeacher(studentId)).doesNotThrowAnyException();
        assertThatThrownBy(() -> student.requireSelfOrTeacher(UUID.randomUUID()))
                .isInstanceOf(ForbiddenException.class)
                .extracting(e -> ((ForbiddenException) e).code()).isEqualTo("access.denied");
    }
}
