package ru.teacherbox.textbooks;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** The cover of a textbook: the first page of a PDF or the picture itself; a Word file has none. */
@TextbooksIntegrationTest
class TextbookCoverIntegrationTests {

    private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G'};

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Test
    void aPdfGetsACoverFromItsFirstPageAndAStudentOfTheTextbookReadsIt() throws Exception {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", boris);
        MvcTestResult created = create(file("Учебник.pdf", TestFiles.pdf(3)), anna, group);
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().extractingPath("$.hasCover").isEqualTo(true);
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        MvcTestResult cover = mvc.get().uri("/api/teacher/textbooks/" + id + "/cover").with(teacher()).exchange();
        assertThat(cover).hasStatusOk().hasContentType(MediaType.IMAGE_PNG)
                .hasHeader("X-Content-Type-Options", "nosniff");
        byte[] picture = cover.getResponse().getContentAsByteArray();
        assertThat(picture).startsWith(PNG_MAGIC);
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(picture));
        assertThat(image.getWidth()).as("a thumbnail, not a 150 dpi page").isLessThanOrEqualTo(600);

        assertThat(mvc.get().uri("/api/me/textbooks/" + id + "/cover").with(TestUsers.student(anna))).hasStatusOk()
                .hasContentType(MediaType.IMAGE_PNG);
        assertThat(mvc.get().uri("/api/me/textbooks/" + id + "/cover").with(TestUsers.student(boris)))
                .as("through the group").hasStatusOk();
        assertThat(mvc.get().uri("/api/me/textbooks").with(TestUsers.student(anna))).hasStatusOk().bodyJson()
                .extractingPath("$[0].hasCover").isEqualTo(true);
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/cover").with(teacher())).as("stored")
                .hasStatusOk();
    }

    @Test
    void anotherStudentGetsNotFoundAndOnlyStudentsUseTheirEndpoint() throws Exception {
        UUID anna = directory.addStudent("Анна");
        UUID stranger = directory.addStudent("Чужой");
        String id = createdId(file("Учебник.pdf", TestFiles.pdf(1)), anna);

        assertThat(mvc.get().uri("/api/me/textbooks/" + id + "/cover").with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/cover").with(TestUsers.student(anna)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/textbooks/" + id + "/cover").with(teacher()))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + UUID.randomUUID() + "/cover").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.textbook-not-found");
    }

    @Test
    void anImageIsItsOwnCoverAndAWordFileHasNone() throws Exception {
        String image = createdId(file("скан.png", TestFiles.png()), null);
        MvcTestResult cover = mvc.get().uri("/api/teacher/textbooks/" + image + "/cover").with(teacher()).exchange();
        assertThat(cover).hasStatusOk().hasContentType(MediaType.IMAGE_PNG);
        assertThat(cover.getResponse().getContentAsByteArray()).isEqualTo(TestFiles.png());

        MvcTestResult word = create(file("Тетрадь.docx", TestFiles.docx()), null, null);
        assertThat(word).hasStatus(HttpStatus.CREATED).bodyJson().extractingPath("$.hasCover").isEqualTo(false);
        String id = JsonPath.read(word.getResponse().getContentAsString(), "$.id");
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/cover").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.cover-not-found");
    }

    @Test
    void aCoverFollowsTheReplacedFileAndGoesWithTheTextbook() throws Exception {
        String id = createdId(file("Учебник.pdf", TestFiles.pdf(2)), null);
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/cover").with(teacher())).hasStatusOk();

        assertThat(mvc.put().uri("/api/teacher/textbooks/" + id + "/file").with(teacher()).multipart()
                .file(file("Тетрадь.docx", TestFiles.docx())).param("version", "0")).hasStatusOk().bodyJson()
                .extractingPath("$.hasCover").isEqualTo(false);
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/cover").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.put().uri("/api/teacher/textbooks/" + id + "/file").with(teacher()).multipart()
                .file(file("Учебник.pdf", TestFiles.pdf(1))).param("version", "1")).hasStatusOk().bodyJson()
                .extractingPath("$.hasCover").isEqualTo(true);
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/cover").with(teacher())).hasStatusOk();

        assertThat(mvc.delete().uri("/api/teacher/textbooks/" + id).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/cover").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private static MockMultipartFile file(String name, byte[] content) {
        return new MockMultipartFile("file", name, "application/octet-stream", content);
    }

    private String createdId(MockMultipartFile file, UUID studentId) throws Exception {
        MvcTestResult created = create(file, studentId, null);
        assertThat(created).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(created.getResponse().getContentAsString(), "$.id");
    }

    private MvcTestResult create(MockMultipartFile file, UUID studentId, UUID groupId) {
        var request = mvc.post().uri("/api/teacher/textbooks").with(teacher()).multipart().file(file)
                .param("kind", "TEXTBOOK").param("title", "Учебник");
        if (studentId != null) {
            request = request.param("studentIds", studentId.toString());
        }
        if (groupId != null) {
            request = request.param("groupIds", groupId.toString());
        }
        return request.exchange();
    }
}
