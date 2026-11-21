package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.homework.api.AssignmentSummary;
import ru.teacherbox.homework.api.Assignments;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.testing.FakeTextbooks;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;
import ru.teacherbox.textbooks.api.TextbookFormat;

/**
 * The bank of assignments (roadmap 11 «Bank»): the first «Выдать» saves the original, «Сохранить в банк» saves or
 * updates it, «Использовать» makes a working draft and never adds to the bank, a bank item is never given out.
 */
@HomeworkIntegrationTest
class AssignmentBankIntegrationTests {

    private static final String BASE = "/api/teacher/homework/assignments";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeTextbooks textbooks;

    @Autowired
    Assignments assignments;

    @Test
    void theFirstGiveOutSavesTheOriginalWithCopiesOfTheMaterials() throws Exception {
        UUID anna = directory.addStudent("Анна банка");
        UUID boris = directory.addStudent("Борис банка");
        UUID spotlight = textbooks.add("Spotlight банка", TextbookFormat.PDF, 50);
        String id = create("""
                {"title":"Present Simple","description":"Упражнения 1-3","dueAt":"2030-02-01T15:00:00Z",
                 "videos":[{"url":"https://youtu.be/dQw4w9WgXcQ","title":"Видео","transcript":"[0:01] Hi",
                            "transcriptShown":false}]}
                """);
        assertThat(mvc.post().uri(BASE + "/" + id + "/textbooks").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"textbookId\":\"%s\",\"pages\":\"4\"}".formatted(spotlight))).hasStatusOk();
        attach(id);
        String workingFile = JsonPath.read(body(get(id)), "$.attachments[0].id");
        assertThat(get(id)).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.bank").isEqualTo(false);
            assertThat(json).extractingPath("$.sourceId").isNull();
        });

        assertThat(give(id, anna)).hasStatusOk();

        String original = JsonPath.read(body(get(id)), "$.sourceId");
        assertThat(original).isNotNull();
        assertThat(get(original)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.bank").isEqualTo(true);
            assertThat(json).extractingPath("$.title").isEqualTo("Present Simple");
            assertThat(json).extractingPath("$.description").isEqualTo("Упражнения 1-3");
            assertThat(json).extractingPath("$.dueAt").isNull();
            assertThat(json).extractingPath("$.tasks.length()").isEqualTo(0);
            assertThat(json).extractingPath("$.textbooks[0].pages").isEqualTo("4");
            assertThat(json).extractingPath("$.videos[0].transcript").isEqualTo("[0:01] Hi");
            assertThat(json).extractingPath("$.attachments[0].filename").isEqualTo("Задачи.pdf");
            assertThat(json).extractingPath("$.uses").isEqualTo(1);
        });
        String bankFile = JsonPath.read(body(get(original)), "$.attachments[0].id");
        assertThat(bankFile).isNotEqualTo(workingFile);

        assertThat(give(id, boris)).as("a later give-out").hasStatusOk();
        assertThat(JsonPath.<String>read(body(get(id)), "$.sourceId")).isEqualTo(original);
        assertThat(bankIds()).containsOnlyOnce(original);
        assertThat(workingIds()).contains(id).doesNotContain(original);
        assertThat(JsonPath.<List<Integer>>read(body(mvc.get().uri(BASE + "?bank=true").with(teacher()).exchange()),
                "$[?(@.id == '" + original + "')].uses")).containsExactly(1);

        assertThat(mvc.delete().uri(BASE + "/" + id).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri("/api/teacher/homework/attachments/" + bankFile).with(teacher())).hasStatusOk()
                .hasBodyTextEqualTo("%PDF-1.4 bank");
    }

    @Test
    void anAssignmentCreatedForStudentsIsSavedToo() throws Exception {
        UUID student = directory.addStudent("Сразу выдано");
        String id = create("{\"title\":\"Сразу\",\"studentIds\":[\"%s\"]}".formatted(student));
        String original = JsonPath.read(body(get(id)), "$.sourceId");
        assertThat(original).isNotNull();
        assertThat(get(original)).bodyJson().extractingPath("$.bank").isEqualTo(true);
    }

    @Test
    void useMakesADraftForTheStudentsAndNeverAddsToTheBank() throws Exception {
        UUID student = directory.addStudent("Использование");
        String original = create("{\"title\":\"Из банка\",\"bank\":true,\"dueAt\":\"2030-02-01T15:00:00Z\"}");
        attach(original);
        assertThat(get(original)).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.bank").isEqualTo(true);
            assertThat(json).extractingPath("$.dueAt").isNull();
        });
        List<String> bankBefore = bankIds();

        MvcTestResult used = use(original, student);

        assertThat(used).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Из банка");
            assertThat(json).extractingPath("$.bank").isEqualTo(false);
            assertThat(json).extractingPath("$.sourceId").isEqualTo(original);
            assertThat(json).extractingPath("$.draftStudentIds[0]").isEqualTo(student.toString());
            assertThat(json).extractingPath("$.tasks.length()").isEqualTo(0);
            assertThat(json).extractingPath("$.attachments[0].filename").isEqualTo("Задачи.pdf");
        });
        String copy = JsonPath.read(body(used), "$.id");
        assertThat(give(copy, student)).hasStatusOk();
        assertThat(bankIds()).as("use never adds to the bank").containsExactlyInAnyOrderElementsOf(bankBefore);
        assertThat(JsonPath.<String>read(body(get(copy)), "$.sourceId")).isEqualTo(original);
        assertThat(get(original)).bodyJson().extractingPath("$.uses").isEqualTo(1);

        assertThat(use(copy, student)).hasStatus(HttpStatus.CONFLICT).bodyJson().extractingPath("$.code")
                .isEqualTo("homework.not-in-bank");
        assertThat(use(original, UUID.randomUUID())).hasStatus(HttpStatus.NOT_FOUND).bodyJson()
                .extractingPath("$.code").isEqualTo("student.not-found");
        assertThat(use(UUID.randomUUID().toString(), student)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void saveToBankCreatesOrUpdatesTheOriginalAndKeepsTheCopies() throws Exception {
        UUID student = directory.addStudent("Обновление банка");
        String working = create("{\"title\":\"Черновик\"}");

        MvcTestResult saved = mvc.post().uri(BASE + "/" + working + "/bank").with(teacher()).exchange();
        assertThat(saved).hasStatusOk();
        String original = JsonPath.read(body(saved), "$.sourceId");
        assertThat(get(original)).bodyJson().extractingPath("$.title").isEqualTo("Черновик");
        String copy = JsonPath.read(body(use(original, student)), "$.id");

        long version = JsonPath.<Number>read(body(get(working)), "$.version").longValue();
        assertThat(mvc.put().uri(BASE + "/" + working).with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Новая версия\",\"description\":\"Текст\",\"version\":%d}".formatted(version)))
                .hasStatusOk();
        attach(working);
        assertThat(mvc.post().uri(BASE + "/" + working + "/bank").with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$.sourceId").isEqualTo(original);
        assertThat(get(original)).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Новая версия");
            assertThat(json).extractingPath("$.description").isEqualTo("Текст");
            assertThat(json).extractingPath("$.attachments.length()").isEqualTo(1);
            assertThat(json).extractingPath("$.uses").isEqualTo(2);
        });
        assertThat(mvc.post().uri(BASE + "/" + working + "/bank").with(teacher())).as("again").hasStatusOk();
        assertThat(get(original)).bodyJson().extractingPath("$.attachments.length()").isEqualTo(1);
        assertThat(get(copy)).bodyJson().extractingPath("$.title").isEqualTo("Черновик");

        assertThat(mvc.post().uri(BASE + "/" + original + "/bank").with(teacher())).hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("homework.bank-item");

        assertThat(mvc.delete().uri(BASE + "/" + original).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(get(copy)).as("a deleted original keeps its copies").hasStatusOk().bodyJson()
                .extractingPath("$.sourceId").isNull();
        assertThat(get(working)).bodyJson().extractingPath("$.sourceId").isNull();
        MvcTestResult again = mvc.post().uri(BASE + "/" + working + "/bank").with(teacher()).exchange();
        assertThat(JsonPath.<String>read(body(again), "$.sourceId")).as("a new original").isNotEqualTo(original)
                .isNotNull();
    }

    @Test
    void aBankItemIsNeverGivenOut() throws Exception {
        UUID student = directory.addStudent("Не выдаётся");
        String original = create("{\"title\":\"Только банк\",\"bank\":true}");

        assertThat(give(original, student)).hasStatus(HttpStatus.CONFLICT).bodyJson().extractingPath("$.code")
                .isEqualTo("homework.bank-item");
        assertThat(mvc.post().uri(BASE).with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Банк ученику\",\"bank\":true,\"studentIds\":[\"%s\"]}".formatted(student)))
                .hasStatus(HttpStatus.CONFLICT).bodyJson().extractingPath("$.code").isEqualTo("homework.bank-item");
        assertThat(mvc.put().uri(BASE + "/" + original + "/draft-students").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content("{\"studentIds\":[\"%s\"]}".formatted(student)))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(mvc.put().uri(BASE + "/" + original + "/board").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content("{\"boardId\":\"%s\"}".formatted(UUID.randomUUID())))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(get(original)).bodyJson().extractingPath("$.tasks.length()").isEqualTo(0);
        String copy = JsonPath.read(body(mvc.post().uri(BASE + "/" + original + "/copy").with(teacher())
                .exchange()), "$.id");
        assertThat(get(copy)).as("a copy of a bank item stays in the bank").bodyJson().extractingPath("$.bank")
                .isEqualTo(true);
    }

    @Test
    void otherModulesFindAssignmentsAndCheckThemForALesson() throws Exception {
        UUID student = directory.addStudent("Фасад");
        String working = create("{\"title\":\"Для урока\",\"studentIds\":[\"%s\"]}".formatted(student));
        String original = JsonPath.read(body(get(working)), "$.sourceId");
        String deleted = create("{\"title\":\"Удалено\"}");
        assertThat(mvc.delete().uri(BASE + "/" + deleted).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);

        List<AssignmentSummary> found = assignments.find(List.of(UUID.fromString(original), UUID.fromString(deleted),
                UUID.fromString(working)));

        assertThat(found).extracting(AssignmentSummary::title).containsExactly("Для урока", "Для урока");
        assertThat(found).extracting(AssignmentSummary::bank).containsExactly(true, false);
        assertThat(found.get(1).studentIds()).containsExactly(student);
        assertThat(assignments.find(List.of())).isEmpty();
        assignments.checkLinkable(UUID.fromString(working));
        assertThatThrownBy(() -> assignments.checkLinkable(UUID.fromString(original)))
                .isInstanceOf(ConflictException.class).hasFieldOrPropertyWithValue("code", "homework.bank-item");
        assertThatThrownBy(() -> assignments.checkLinkable(UUID.fromString(deleted)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void onlyTheTeacherUsesTheBank() {
        UUID student = directory.addStudent("Ученик без банка");
        String id = UUID.randomUUID().toString();
        assertThat(mvc.post().uri(BASE + "/" + id + "/bank").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri(BASE + "/" + id + "/use").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"studentIds\":[]}"))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(BASE + "?bank=true").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri(BASE + "/" + id + "/bank").with(teacher())).hasStatus(HttpStatus.NOT_FOUND);
    }

    private String create(String json) throws Exception {
        MvcTestResult created = mvc.post().uri(BASE).with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content(json).exchange();
        assertThat(created).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(body(created), "$.id");
    }

    private void attach(String id) {
        assertThat(mvc.post().uri(BASE + "/" + id + "/attachments").with(teacher()).multipart()
                .file(new MockMultipartFile("files", "Задачи.pdf", "application/octet-stream",
                        "%PDF-1.4 bank".getBytes(StandardCharsets.UTF_8)))
                .exchange()).hasStatus(HttpStatus.CREATED);
    }

    private MvcTestResult give(String id, UUID student) {
        return mvc.post().uri(BASE + "/" + id + "/students").with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentIds\":[\"%s\"]}".formatted(student)).exchange();
    }

    private MvcTestResult use(String id, UUID student) {
        return mvc.post().uri(BASE + "/" + id + "/use").with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentIds\":[\"%s\"]}".formatted(student)).exchange();
    }

    private MvcTestResult get(String id) {
        return mvc.get().uri(BASE + "/" + id).with(teacher()).exchange();
    }

    private List<String> bankIds() throws Exception {
        return JsonPath.read(body(mvc.get().uri(BASE + "?bank=true").with(teacher()).exchange()), "$[*].id");
    }

    private List<String> workingIds() throws Exception {
        return JsonPath.read(body(mvc.get().uri(BASE).with(teacher()).exchange()), "$[*].id");
    }

    private static String body(MvcTestResult result) throws Exception {
        return AssignmentIntegrationTests.body(result);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}
