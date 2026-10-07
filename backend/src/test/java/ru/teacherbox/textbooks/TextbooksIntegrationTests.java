package ru.teacherbox.textbooks;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;
import ru.teacherbox.textbooks.api.PageRanges;
import ru.teacherbox.textbooks.api.TextbookContent;
import ru.teacherbox.textbooks.api.TextbookFormat;
import ru.teacherbox.textbooks.api.TextbookKind;
import ru.teacherbox.textbooks.api.Textbooks;

/** Textbooks with their files, students and groups through the teacher's and the student's API (ADR-0033). */
@TextbooksIntegrationTest
class TextbooksIntegrationTests {

    private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G'};

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    MutableClock clock;

    @Autowired
    Textbooks facade;

    @Test
    void theTeacherSharesATextbookWithStudentsAndGroups() throws Exception {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", boris);

        MvcTestResult created = create(file("Spotlight 5.pdf", TestFiles.pdf(3)), "TEXTBOOK", " Spotlight 5 ",
                "Английский", anna, group);
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Spotlight 5");
            assertThat(json).extractingPath("$.course").isEqualTo("Английский");
            assertThat(json).extractingPath("$.format").isEqualTo("PDF");
            assertThat(json).extractingPath("$.pageCount").isEqualTo(3);
            assertThat(json).extractingPath("$.contentType").isEqualTo("application/pdf");
            assertThat(json).extractingPath("$.filename").isEqualTo("Spotlight 5.pdf");
            assertThat(json).extractingPath("$.members[*].name").asArray().containsExactly("Анна", "ОГЭ");
        });
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        clock.advance(Duration.ofMinutes(1));
        MvcTestResult workbook = create(file("Тетрадь.docx", TestFiles.docx()), "WORKBOOK", "Тетрадь", null, boris,
                null, "pageCount", "48");
        assertThat(workbook).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.format").isEqualTo("DOCUMENT");
            assertThat(json).extractingPath("$.pageCount").isEqualTo(48);
            assertThat(json).extractingPath("$.course").isNull();
        });

        assertThat(mvc.get().uri("/api/teacher/textbooks").with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[*].title").asArray().containsSubsequence("Тетрадь", "Spotlight 5");
        assertThat(mvc.get().uri("/api/me/textbooks").with(TestUsers.student(boris))).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$[*].title").asArray().containsExactly("Тетрадь", "Spotlight 5");
                    assertThat(json).extractingPath("$[0].groupNames").asArray().isEmpty();
                    assertThat(json).extractingPath("$[1].groupNames").asArray().containsExactly("ОГЭ");
                });

        MvcTestResult download = mvc.get().uri("/api/me/textbooks/" + id + "/file").with(TestUsers.student(anna))
                .exchange();
        assertThat(download).hasStatusOk().hasHeader("X-Content-Type-Options", "nosniff")
                .hasContentType("application/pdf");
        assertThat(download.getResponse().getHeader("Content-Disposition")).startsWith("attachment");
        UUID stranger = directory.addStudent("Чужой");
        assertThat(mvc.get().uri("/api/me/textbooks").with(TestUsers.student(stranger))).hasStatusOk()
                .bodyJson().extractingPath("$").asArray().isEmpty();
        assertThat(mvc.get().uri("/api/me/textbooks/" + id + "/file").with(TestUsers.student(stranger)))
                .as("another student").hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/file").with(teacher())).hasStatusOk();

        assertThat(put(id, """
                {"kind":"WORKBOOK","title":"Spotlight 5 WB","course":" ","pageCount":99,"groupIds":["%s"],
                 "version":0}""".formatted(group)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.version").isEqualTo(1);
                    assertThat(json).extractingPath("$.kind").isEqualTo("WORKBOOK");
                    assertThat(json).extractingPath("$.course").isNull();
                    assertThat(json).extractingPath("$.pageCount").as("a PDF counts its own").isEqualTo(3);
                    assertThat(json).extractingPath("$.members[*].name").asArray().containsExactly("ОГЭ");
                });
        assertThat(put(id, "{\"kind\":\"OTHER\",\"title\":\"Старое\",\"version\":0}"))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(mvc.get().uri("/api/me/textbooks/" + id + "/file").with(TestUsers.student(anna)))
                .as("no longer a member").hasStatus(HttpStatus.NOT_FOUND);

        assertThat(mvc.delete().uri("/api/teacher/textbooks/" + id).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.delete().uri("/api/teacher/textbooks/" + id).with(teacher())).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("textbooks.textbook-not-found");
    }

    @Test
    void pagesArePicturesForBoards() throws Exception {
        String id = createdId(file("Учебник.pdf", TestFiles.pdf(3)));

        MvcTestResult page = mvc.get().uri("/api/teacher/textbooks/" + id + "/pages/2").with(teacher()).exchange();
        assertThat(page).hasStatusOk().hasContentType(MediaType.IMAGE_PNG);
        assertThat(page.getResponse().getContentAsByteArray()).startsWith(PNG_MAGIC);
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/pages/3").with(teacher()))
                .as("a turned page").hasStatusOk();
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/pages/4").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.page-not-found");
        String wide = createdId(file("Разворот.pdf", TestFiles.widePdf()));
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + wide + "/pages/1").with(teacher())).hasStatusOk();

        MvcTestResult replaced = mvc.put().uri("/api/teacher/textbooks/" + id + "/file").with(teacher()).multipart()
                .file(file("скан.png", TestFiles.png())).param("version", "0").exchange();
        assertThat(replaced).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.format").isEqualTo("IMAGE");
            assertThat(json).extractingPath("$.pageCount").isEqualTo(1);
            assertThat(json).extractingPath("$.filename").isEqualTo("скан.png");
            assertThat(json).extractingPath("$.version").isEqualTo(1);
        });
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/pages/1").with(teacher())).hasStatusOk()
                .hasContentType(MediaType.IMAGE_PNG);
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/pages/2").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);

        MvcTestResult document = mvc.put().uri("/api/teacher/textbooks/" + id + "/file").with(teacher()).multipart()
                .file(file("Тетрадь.doc", TestFiles.doc())).param("version", "1").exchange();
        assertThat(document).hasStatusOk().bodyJson().extractingPath("$.pageCount").isNull();
        assertThat(mvc.get().uri("/api/teacher/textbooks/" + id + "/pages/1").with(teacher()))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.not-paged");
        assertThat(put(id, "{\"kind\":\"OTHER\",\"title\":\"Тетрадь\",\"pageCount\":20,\"version\":2}"))
                .hasStatusOk().bodyJson().extractingPath("$.pageCount").isEqualTo(20);
        MvcTestResult docx = mvc.put().uri("/api/teacher/textbooks/" + id + "/file").with(teacher()).multipart()
                .file(file("Тетрадь.docx", TestFiles.docx())).param("version", "3").exchange();
        assertThat(docx).as("a document after a document keeps the count").hasStatusOk().bodyJson()
                .extractingPath("$.pageCount").isEqualTo(20);
        assertThat(mvc.put().uri("/api/teacher/textbooks/" + id + "/file").with(teacher()).multipart()
                .file(file("x.png", TestFiles.png())).param("version", "3"))
                .hasStatus(HttpStatus.CONFLICT);
    }

    @Test
    void homeworkGetsTheBoundPages() throws Exception {
        String id = createdId(file("Учебник.pdf", TestFiles.pdf(5)));
        UUID textbookId = UUID.fromString(id);

        assertThat(facade.find(textbookId)).hasValueSatisfying(summary -> {
            assertThat(summary.format()).isEqualTo(TextbookFormat.PDF);
            assertThat(summary.pageCount()).isEqualTo(5);
            assertThat(summary.kind()).isEqualTo(TextbookKind.TEXTBOOK);
        });
        assertThat(facade.find(java.util.List.of(textbookId, UUID.randomUUID()))).hasSize(1);
        assertThat(facade.find(UUID.randomUUID())).isEmpty();

        TextbookContent cut = facade.content(textbookId, PageRanges.parse("2-3, 9"));
        assertThat(cut.filename()).isEqualTo("Учебник (с. 2-3, 9).pdf");
        try (PDDocument pdf = Loader.loadPDF(cut.content().getContentAsByteArray())) {
            assertThat(pdf.getNumberOfPages()).isEqualTo(2);
        }
        assertThat(cut.size()).isEqualTo(cut.content().contentLength());
        assertThat(facade.file(textbookId).filename()).isEqualTo("Учебник.pdf");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> facade.content(textbookId, PageRanges.parse("7")))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("5 pages");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> facade.content(UUID.randomUUID(), PageRanges.all(1)))
                .isInstanceOf(NotFoundException.class);

        String image = createdId(file("скан.jpg", new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 1}));
        TextbookContent whole = facade.content(UUID.fromString(image), PageRanges.parse("1"));
        assertThat(whole.contentType()).isEqualTo("image/jpeg");
        assertThat(whole.filename()).isEqualTo("скан.jpg");
        assertThat(whole.size()).isEqualTo(5);
    }

    @Test
    void onlyKnownFilesAndCurrentMembers() throws Exception {
        UUID gone = directory.addStudent("Ушёл", StudentStatus.DEACTIVATED);
        UUID archived = groups.addGroup("Архив");
        groups.archive(archived);

        assertThat(create(file("a.svg", "<svg/>".getBytes(StandardCharsets.UTF_8)), "OTHER", "Картинка", null, null,
                null)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.file-type-not-allowed");
        assertThat(create(file("a.doc", TestFiles.docx()), "OTHER", "Не тот", null, null, null))
                .as("a docx named .doc").hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(create(file("a.pdf", "%PDF-1.7 broken".getBytes(StandardCharsets.US_ASCII)), "OTHER", "Сломан",
                null, null, null)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.pdf-unreadable");
        assertThat(create(file("a.png", new byte[0]), "OTHER", "Пусто", null, null, null))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.file-empty");
        assertThat(create(file("a.png", TestFiles.png()), "OTHER", " ", null, null, null))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.title-invalid");
        assertThat(create(file("a.png", TestFiles.png()), "OTHER", "Ученик ушёл", null, gone, null))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.student-not-found");
        assertThat(create(file("a.png", TestFiles.png()), "OTHER", "Группа в архиве", null, null, archived))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.group-not-found");

        UUID vera = directory.addStudent("Вера");
        MvcTestResult created = create(file("a.png", TestFiles.png()), "OTHER", "Вера", null, vera, null);
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        directory.setStatus(vera, StudentStatus.DEACTIVATED);
        assertThat(put(id, "{\"kind\":\"OTHER\",\"title\":\"Вера\",\"studentIds\":[\"%s\"],\"version\":0}"
                .formatted(vera))).as("a member the textbook already has stays").hasStatusOk();
        assertThat(put(id, "{\"kind\":\"OTHER\",\"title\":\"Вера\",\"studentIds\":[\"%s\"],\"version\":1}"
                .formatted(gone))).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(put(id, "{\"title\":\"Без вида\",\"version\":1}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(put(UUID.randomUUID().toString(), "{\"kind\":\"OTHER\",\"title\":\"Нет\",\"version\":0}"))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void onlyTheTeacherManagesAndOnlyStudentsHaveTextbooks() {
        UUID student = directory.addStudent("Любопытный");
        assertThat(mvc.get().uri("/api/teacher/textbooks").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/textbooks").with(teacher())).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/textbooks/" + UUID.randomUUID() + "/file").with(teacher()))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private static MockMultipartFile file(String name, byte[] content) {
        return new MockMultipartFile("file", name, "application/octet-stream", content);
    }

    private String createdId(MockMultipartFile file) throws Exception {
        MvcTestResult created = create(file, "TEXTBOOK", "Учебник", null, null, null);
        assertThat(created).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(created.getResponse().getContentAsString(), "$.id");
    }

    private MvcTestResult create(MockMultipartFile file, String kind, String title, String course, UUID studentId,
            UUID groupId, String... more) {
        var request = mvc.post().uri("/api/teacher/textbooks").with(teacher()).multipart().file(file)
                .param("kind", kind).param("title", title);
        if (course != null) {
            request = request.param("course", course);
        }
        if (studentId != null) {
            request = request.param("studentIds", studentId.toString());
        }
        if (groupId != null) {
            request = request.param("groupIds", groupId.toString());
        }
        for (int i = 0; i < more.length; i += 2) {
            request = request.param(more[i], more[i + 1]);
        }
        return request.exchange();
    }

    private MvcTestResult put(String id, String json) {
        return mvc.put().uri("/api/teacher/textbooks/" + id).with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content(json).exchange();
    }
}
