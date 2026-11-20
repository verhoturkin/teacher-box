package ru.teacherbox.textbooks;

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
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;
import ru.teacherbox.textbooks.api.LessonPlanView;
import ru.teacherbox.textbooks.api.LessonPlans;
import ru.teacherbox.textbooks.api.VideoLink;

/** Lesson plans and the bank of plans (roadmap 11, «Bank»). */
@TextbooksIntegrationTest
class LessonPlansIntegrationTests {

    private static final String PLANS = "/api/teacher/textbooks/plans";
    private static final String VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    LessonPlans facade;

    @Test
    void theTeacherWritesAPlanWithTextbooksAndVideos() throws Exception {
        String textbook = createTextbook("Учебник плана", 10);
        String course = createCourse("Курс плана");

        MvcTestResult created = post(PLANS, """
                {"title":" Урок 1 ","body":"## Разминка","courseId":"%s",
                 "textbooks":[{"textbookId":"%s","pages":"3, 1-2"}],
                 "videos":[{"url":"%s","title":"Песня","transcript":"[0:01] Hi","transcriptShown":false}]}
                """.formatted(course, textbook, VIDEO));
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Урок 1");
            assertThat(json).extractingPath("$.body").isEqualTo("## Разминка");
            assertThat(json).extractingPath("$.courseId").isEqualTo(course);
            assertThat(json).extractingPath("$.bank").isEqualTo(false);
            assertThat(json).extractingPath("$.sourceId").isNull();
            assertThat(json).extractingPath("$.textbooks[0].title").isEqualTo("Учебник плана");
            assertThat(json).extractingPath("$.textbooks[0].pages").isEqualTo("1-3");
            assertThat(json).extractingPath("$.textbooks[0].pageCount").isEqualTo(10);
            assertThat(json).extractingPath("$.videos[0].provider").isEqualTo("YOUTUBE");
            assertThat(json).extractingPath("$.videos[0].transcript").isEqualTo("[0:01] Hi");
            assertThat(json).extractingPath("$.videos[0].transcriptShown").isEqualTo(false);
            assertThat(json).extractingPath("$.version").isEqualTo(0);
        });
        String id = id(created);

        assertThat(put(PLANS + "/" + id, """
                {"title":"Урок 1 (новый)","body":"","textbooks":[{"textbookId":"%s"}],"videos":[],"version":0}
                """.formatted(textbook))).hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Урок 1 (новый)");
                    assertThat(json).extractingPath("$.courseId").isNull();
                    assertThat(json).extractingPath("$.textbooks[0].pages").isNull();
                    assertThat(json).extractingPath("$.videos").asArray().isEmpty();
                    assertThat(json).extractingPath("$.version").isEqualTo(1);
                });
        assertThat(put(PLANS + "/" + id, "{\"title\":\"X\",\"version\":0}")).as("stale version")
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(mvc.get().uri(PLANS + "/" + id).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$.title").isEqualTo("Урок 1 (новый)");
        assertThat(mvc.get().uri(PLANS).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[?(@.id == '%s')].title".formatted(id)).asArray()
                .containsExactly("Урок 1 (новый)");

        assertThat(mvc.delete().uri(PLANS + "/" + id).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri(PLANS + "/" + id).with(teacher())).hasStatus(HttpStatus.NOT_FOUND).bodyJson()
                .extractingPath("$.code").isEqualTo("textbooks.plan-not-found");
        assertThat(mvc.delete().uri(PLANS + "/" + id).with(teacher())).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(put(PLANS + "/" + id, "{\"title\":\"X\",\"version\":1}")).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void aPlanFollowsTheRulesOfHomework() throws Exception {
        String textbook = createTextbook("Правила", 5);
        String video = "{\"url\":\"%s\",\"transcriptShown\":false}".formatted(VIDEO);

        assertThat(post(PLANS, "{\"title\":\" \"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post(PLANS, "{\"title\":\"%s\"}".formatted("т".repeat(201)))).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post(PLANS, "{\"title\":\"Т\",\"body\":\"%s\"}".formatted("т".repeat(20_001))))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post(PLANS, "{\"title\":\"Т\",\"videos\":[%s]}".formatted(String.join(",",
                List.of(video, video, video, video, video, video))))).as("over 5 videos")
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post(PLANS, "{\"title\":\"Т\",\"videos\":[{\"url\":\"ftp://x\",\"transcriptShown\":false}]}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("video.link-invalid");
        assertThat(post(PLANS, "{\"title\":\"Т\",\"courseId\":\"%s\"}".formatted(UUID.randomUUID())))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.course-not-found");
        assertThat(post(PLANS, "{\"title\":\"Т\",\"textbooks\":[{\"textbookId\":\"%s\"}]}".formatted(
                UUID.randomUUID()))).hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.textbook-not-found");
        assertThat(post(PLANS, "{\"title\":\"Т\",\"textbooks\":[{\"textbookId\":\"%s\",\"pages\":\"4-6\"}]}"
                .formatted(textbook))).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson()
                .extractingPath("$.code").isEqualTo("textbooks.pages-beyond");
        assertThat(post(PLANS, "{\"title\":\"Т\",\"textbooks\":[{\"textbookId\":\"%s\",\"pages\":\"а\"}]}"
                .formatted(textbook))).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson()
                .extractingPath("$.code").isEqualTo("textbooks.pages-invalid");
        assertThat(post(PLANS, "{\"title\":\"Т\",\"textbooks\":[{\"textbookId\":\"%1$s\"},{\"textbookId\":\"%1$s\"}]}"
                .formatted(textbook))).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson()
                .extractingPath("$.code").isEqualTo("textbooks.plan-textbook-twice");
    }

    @Test
    void theFirstFinishSavesTheOriginalIntoTheBank() throws Exception {
        String textbook = createTextbook("Готово", 4);
        String working = id(post(PLANS, """
                {"title":"Новый урок","body":"План","textbooks":[{"textbookId":"%s","pages":"2"}],
                 "videos":[{"url":"%s","transcript":"[0:00] Hello","transcriptShown":true}]}
                """.formatted(textbook, VIDEO)));

        MvcTestResult finished = mvc.post().uri(PLANS + "/" + working + "/finish").with(teacher()).exchange();
        assertThat(finished).hasStatusOk().bodyJson().extractingPath("$.sourceId").isNotNull();
        String original = JsonPath.read(body(finished), "$.sourceId");
        assertThat(mvc.get().uri(PLANS + "/" + original).with(teacher())).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.bank").isEqualTo(true);
                    assertThat(json).extractingPath("$.sourceId").isNull();
                    assertThat(json).extractingPath("$.title").isEqualTo("Новый урок");
                    assertThat(json).extractingPath("$.textbooks[0].pages").isEqualTo("2");
                    assertThat(json).extractingPath("$.videos[0].transcript").isEqualTo("[0:00] Hello");
                    assertThat(json).extractingPath("$.videos[0].transcriptShown").isEqualTo(true);
                    assertThat(json).extractingPath("$.uses").isEqualTo(1);
                });

        assertThat(mvc.post().uri(PLANS + "/" + working + "/finish").with(teacher())).as("the second «Готово»")
                .hasStatusOk().bodyJson().extractingPath("$.sourceId").isEqualTo(original);
        assertThat(mvc.post().uri(PLANS + "/" + original + "/finish").with(teacher())).as("a bank item")
                .hasStatusOk().bodyJson().extractingPath("$.bank").isEqualTo(true);
        assertThat(bankIds()).containsOnlyOnce(original);
        assertThat(mvc.post().uri(PLANS + "/" + UUID.randomUUID() + "/finish").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void useNeverAddsToTheBank() throws Exception {
        String original = id(post(PLANS, """
                {"title":"Банк","body":"Из банка","bank":true,
                 "videos":[{"url":"%s","transcript":"[0:00] A","transcriptShown":false}]}
                """.formatted(VIDEO)));
        UUID lesson = UUID.randomUUID();
        List<String> before = bankIds();

        MvcTestResult used = post(PLANS + "/" + original + "/use", "{\"lessonId\":\"%s\"}".formatted(lesson));
        assertThat(used).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.lessonId").isEqualTo(lesson.toString());
            assertThat(json).extractingPath("$.plan.bank").isEqualTo(false);
            assertThat(json).extractingPath("$.plan.sourceId").isEqualTo(original);
            assertThat(json).extractingPath("$.plan.body").isEqualTo("Из банка");
            assertThat(json).extractingPath("$.plan.videos[0].transcript").isEqualTo("[0:00] A");
        });
        String copy = JsonPath.read(body(used), "$.plan.id");
        assertThat(mvc.post().uri(PLANS + "/" + copy + "/finish").with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$.sourceId").isEqualTo(original);
        post(PLANS + "/" + original + "/use", "{\"lessonId\":\"%s\"}".formatted(UUID.randomUUID()));

        assertThat(bankIds()).containsExactlyInAnyOrderElementsOf(before);
        assertThat(mvc.get().uri(PLANS + "?bank=true").with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[?(@.id == '%s')].uses".formatted(original)).asArray().containsExactly(2);
        assertThat(mvc.get().uri(PLANS).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[*].id").asArray().contains(copy).doesNotContain(original);

        String edited = put(PLANS + "/" + original, "{\"title\":\"Банк 2\",\"version\":0}").getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(JsonPath.<String>read(edited, "$.title")).isEqualTo("Банк 2");
        assertThat(mvc.get().uri(PLANS + "/" + copy).with(teacher())).as("editing the original keeps the copy")
                .hasStatusOk().bodyJson().extractingPath("$.title").isEqualTo("Банк");

        assertThat(post(PLANS + "/" + copy + "/use", "{\"lessonId\":\"%s\"}".formatted(lesson)))
                .as("a working plan").hasStatus(HttpStatus.CONFLICT).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.plan-not-in-bank");
        assertThat(post(PLANS + "/" + original + "/use", "{}")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void aWorkingPlanSavesAndUpdatesItsOriginal() throws Exception {
        String textbook = createTextbook("Обновить", 3);
        String working = id(post(PLANS, "{\"title\":\"Рабочий\",\"body\":\"v1\"}"));

        MvcTestResult saved = mvc.post().uri(PLANS + "/" + working + "/bank").with(teacher()).exchange();
        assertThat(saved).hasStatusOk();
        String original = JsonPath.read(body(saved), "$.sourceId");
        long version = ((Number) JsonPath.read(body(saved), "$.version")).longValue();

        assertThat(put(PLANS + "/" + working, """
                {"title":"Рабочий 2","body":"v2","textbooks":[{"textbookId":"%s","pages":"1"}],"version":%d}
                """.formatted(textbook, version))).hasStatusOk();
        assertThat(mvc.post().uri(PLANS + "/" + working + "/bank").with(teacher())).as("«Обновить в банке»")
                .hasStatusOk().bodyJson().extractingPath("$.sourceId").isEqualTo(original);
        assertThat(mvc.get().uri(PLANS + "/" + original).with(teacher())).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Рабочий 2");
                    assertThat(json).extractingPath("$.body").isEqualTo("v2");
                    assertThat(json).extractingPath("$.textbooks[0].pages").isEqualTo("1");
                    assertThat(json).extractingPath("$.version").isEqualTo(1);
                });
        assertThat(mvc.post().uri(PLANS + "/" + original + "/bank").with(teacher())).as("a bank item")
                .hasStatus(HttpStatus.CONFLICT).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.plan-in-bank");
    }

    @Test
    void aDeletedOriginalKeepsItsCopies() throws Exception {
        String original = id(post(PLANS, "{\"title\":\"Удаляемый\",\"bank\":true}"));
        String copy = JsonPath.read(body(post(PLANS + "/" + original + "/use",
                "{\"lessonId\":\"%s\"}".formatted(UUID.randomUUID()))), "$.plan.id");

        assertThat(mvc.delete().uri(PLANS + "/" + original).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri(PLANS + "/" + copy).with(teacher())).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Удаляемый");
            assertThat(json).extractingPath("$.sourceId").isNull();
        });

        MvcTestResult again = mvc.post().uri(PLANS + "/" + copy + "/bank").with(teacher()).exchange();
        assertThat(again).as("no original — a new one").hasStatusOk();
        String newOriginal = JsonPath.read(body(again), "$.sourceId");
        assertThat(newOriginal).isNotEqualTo(original);
        assertThat(bankIds()).contains(newOriginal).doesNotContain(original);
    }

    @Test
    void aDeletedTextbookOrCourseLeavesThePlan() throws Exception {
        String textbook = createTextbook("Уйдёт", 2);
        String course = createCourse("Курс уйдёт");
        String plan = id(post(PLANS, "{\"title\":\"Остаётся\",\"courseId\":\"%s\",\"textbooks\":[{\"textbookId\":\"%s\"}]}"
                .formatted(course, textbook)));

        assertThat(mvc.delete().uri("/api/teacher/textbooks/" + textbook).with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.delete().uri("/api/teacher/textbooks/courses/" + course).with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri(PLANS + "/" + plan).with(teacher())).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.textbooks").asArray().isEmpty();
            assertThat(json).extractingPath("$.courseId").isNull();
            assertThat(json).extractingPath("$.version").isEqualTo(1);
        });
    }

    @Test
    void otherModulesReadPlansAndCheckLinks() throws Exception {
        String textbook = createTextbook("Фасад", 6);
        UUID working = UUID.fromString(id(post(PLANS, """
                {"title":"Для урока","body":"Текст","textbooks":[{"textbookId":"%s","pages":"5-6"}],
                 "videos":[{"url":"%s","transcript":"[0:00] T","transcriptShown":false}]}
                """.formatted(textbook, VIDEO))));
        UUID bank = UUID.fromString(id(post(PLANS, "{\"title\":\"Оригинал\",\"bank\":true}")));

        List<LessonPlanView> found = facade.find(List.of(working, bank, UUID.randomUUID()));
        assertThat(found).extracting(LessonPlanView::id).containsExactlyInAnyOrder(working, bank);
        LessonPlanView view = found.stream().filter(plan -> plan.id().equals(working)).findFirst().orElseThrow();
        assertThat(view.bank()).isFalse();
        assertThat(view.body()).isEqualTo("Текст");
        assertThat(view.textbooks()).singleElement().satisfies(bound -> {
            assertThat(bound.title()).isEqualTo("Фасад");
            assertThat(bound.pages()).isEqualTo("5-6");
        });
        assertThat(view.videos()).singleElement().satisfies(video -> {
            assertThat(video.provider()).isEqualTo(VideoLink.Provider.YOUTUBE);
            assertThat(video.transcriptShown()).isFalse();
        });
        assertThat(facade.find(List.of())).isEmpty();

        facade.checkLinkable(working);
        assertThatThrownBy(() -> facade.checkLinkable(bank)).isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("code", "textbooks.plan-in-bank");
        assertThatThrownBy(() -> facade.checkLinkable(UUID.randomUUID())).isInstanceOf(NotFoundException.class)
                .hasFieldOrPropertyWithValue("code", "textbooks.plan-not-found");
    }

    @Test
    void onlyTheTeacherKeepsPlans() throws Exception {
        String plan = id(post(PLANS, "{\"title\":\"Чужой\",\"bank\":true}"));
        for (RequestPostProcessor other : List.of(TestUsers.student(directory.addStudent("Ученик")),
                TestUsers.admin(UUID.randomUUID()))) {
            assertThat(mvc.get().uri(PLANS + "?bank=true").with(other)).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.get().uri(PLANS + "/" + plan).with(other)).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.post().uri(PLANS).with(other).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"title\":\"X\"}")).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.put().uri(PLANS + "/" + plan).with(other).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"title\":\"X\",\"version\":0}")).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.delete().uri(PLANS + "/" + plan).with(other)).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.post().uri(PLANS + "/" + plan + "/finish").with(other)).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.post().uri(PLANS + "/" + plan + "/bank").with(other)).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.post().uri(PLANS + "/" + plan + "/use").with(other).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"lessonId\":\"%s\"}".formatted(UUID.randomUUID()))).hasStatus(HttpStatus.FORBIDDEN);
        }
        assertThat(mvc.get().uri(PLANS + "/" + plan).with(teacher())).hasStatusOk();
    }

    private List<String> bankIds() throws Exception {
        MvcTestResult listed = mvc.get().uri(PLANS + "?bank=true").with(teacher()).exchange();
        assertThat(listed).hasStatusOk();
        return JsonPath.read(body(listed), "$[*].id");
    }

    private String createTextbook(String title, int pages) throws Exception {
        MvcTestResult created = mvc.post().uri("/api/teacher/textbooks").with(teacher()).multipart()
                .file(new MockMultipartFile("file", "a.pdf", "application/pdf", TestFiles.pdf(pages)))
                .param("kind", "TEXTBOOK").param("title", title).exchange();
        assertThat(created).hasStatus(HttpStatus.CREATED);
        return id(created);
    }

    private String createCourse(String name) throws Exception {
        MvcTestResult created = post("/api/teacher/textbooks/courses", "{\"name\":\"%s\"}".formatted(name));
        assertThat(created).hasStatus(HttpStatus.CREATED);
        return id(created);
    }

    private static String id(MvcTestResult result) throws Exception {
        return JsonPath.read(body(result), "$.id");
    }

    private static String body(MvcTestResult result) throws Exception {
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private MvcTestResult post(String uri, String json) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult put(String uri, String json) {
        return mvc.put().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}
