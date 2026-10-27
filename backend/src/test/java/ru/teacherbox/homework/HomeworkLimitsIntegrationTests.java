package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** The attachment limits the picker checks files against before they are sent. */
@HomeworkIntegrationTest
class HomeworkLimitsIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Test
    void teacherAndStudentSeeTheConfiguredLimits() {
        UUID student = directory.addStudent("Анна");

        assertThat(mvc.get().uri("/api/me/homework/limits").with(TestUsers.teacher(directory.teacherId())))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.maxFileSize").isEqualTo(1024);
                    assertThat(json).extractingPath("$.maxFilesPerUpload").isEqualTo(2);
                });
        assertThat(mvc.get().uri("/api/me/homework/limits").with(TestUsers.student(student)))
                .hasStatusOk().bodyJson().extractingPath("$.maxFileSize").isEqualTo(1024);
    }

    @Test
    void requiresSignIn() {
        assertThat(mvc.get().uri("/api/me/homework/limits")).hasStatus(HttpStatus.UNAUTHORIZED);
    }
}
