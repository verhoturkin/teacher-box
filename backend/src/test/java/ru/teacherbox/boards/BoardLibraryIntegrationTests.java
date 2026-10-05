package ru.teacherbox.boards;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** The Excalidraw library of each user: kept between visits, never shared, closed to the administrator. */
@BoardsIntegrationTest
class BoardLibraryIntegrationTests {

    private static final String ITEM = """
            {"id":"%s","status":"unpublished","created":1,"elements":[{"id":"e","type":"ellipse"}]}""";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Test
    void eachUserKeepsTheirOwnLibrary() {
        UUID student = directory.addStudent("Библиотекарь");
        RequestPostProcessor teacher = TestUsers.teacher(directory.teacherId());
        RequestPostProcessor pupil = TestUsers.student(student);

        assertThat(mvc.get().uri("/api/boards/library").with(pupil)).hasStatusOk().bodyJson()
                .extractingPath("$").asArray().isEmpty();
        assertThat(save(teacher, "[" + ITEM.formatted("circle") + "]")).hasStatusOk();
        assertThat(save(teacher, "[" + ITEM.formatted("circle") + "," + ITEM.formatted("oval") + "]")).hasStatusOk();
        assertThat(save(pupil, "[" + ITEM.formatted("mine") + "]")).hasStatusOk();

        assertThat(mvc.get().uri("/api/boards/library").with(teacher)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[*].id").asArray().containsExactly("circle", "oval");
            assertThat(json).extractingPath("$[0].elements[0].type").isEqualTo("ellipse");
        });
        assertThat(mvc.get().uri("/api/boards/library").with(pupil)).hasStatusOk().bodyJson()
                .extractingPath("$[*].id").asArray().containsExactly("mine");
        assertThat(save(pupil, "[]")).hasStatusOk();
        assertThat(mvc.get().uri("/api/boards/library").with(pupil)).hasStatusOk().bodyJson()
                .extractingPath("$").asArray().isEmpty();
    }

    @Test
    void rejectsWhatIsNotALibrary() {
        RequestPostProcessor teacher = TestUsers.teacher(directory.teacherId());

        assertThat(save(teacher, "{}")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson()
                .extractingPath("$.code").isEqualTo("boards.library-invalid");
        assertThat(save(teacher, "[{\"id\":\"x\"}]")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(save(teacher, "[{\"id\":\"\",\"elements\":[]}]")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(save(teacher, "[{\"id\":\"" + "x".repeat(101) + "\",\"elements\":[]}]"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(save(teacher, "[1]")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        String huge = "[{\"id\":\"big\",\"elements\":[{\"text\":\"" + "a".repeat(2_000_000) + "\"}]}]";
        assertThat(save(teacher, huge)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson()
                .extractingPath("$.code").isEqualTo("boards.library-too-large");
    }

    @Test
    void theAdministratorHasNoLibrary() {
        RequestPostProcessor admin = TestUsers.admin(UUID.randomUUID());

        assertThat(mvc.get().uri("/api/boards/library").with(admin)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(save(admin, "[]")).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/boards/library")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    private MvcTestResult save(RequestPostProcessor user, String items) {
        return mvc.put().uri("/api/boards/library").with(user).contentType(MediaType.APPLICATION_JSON)
                .content(items).exchange();
    }
}
