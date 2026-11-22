package ru.teacherbox.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.ai.persistence.AiRequestRepository;
import ru.teacherbox.homework.api.HomeworkJournal;
import ru.teacherbox.homework.api.JournalTask;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.JournalLesson;
import ru.teacherbox.schedule.api.LessonJournal;
import ru.teacherbox.schedule.api.LessonOutcome;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;
import ru.teacherbox.textbooks.api.LessonPlanView;
import ru.teacherbox.textbooks.api.LessonPlans;
import ru.teacherbox.textbooks.api.TextbookFormat;
import ru.teacherbox.textbooks.api.TextbookKind;
import ru.teacherbox.textbooks.api.VideoLink;

/** A student's period summary: the facts read through the journals of schedule and homework (ADR-0072). */
@AiIntegrationTest
class PeriodSummaryIntegrationTests {

    private static final String URI = "/api/teacher/ai/period-summary";
    private static final UUID STUDENT = UUID.randomUUID();
    private static final LocalDate FROM = LocalDate.parse("2026-10-01");
    private static final LocalDate TO = LocalDate.parse("2026-10-31");
    private static final String BODY = """
            {"studentId": "%s", "from": "2026-10-01", "to": "2026-10-31"}
            """.formatted(STUDENT);

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeLlmClient llm;

    @Autowired
    AiRequestRepository requests;

    @Autowired
    MutableClock clock;

    @Autowired
    LessonJournal lessons;

    @Autowired
    HomeworkJournal homework;

    @Autowired
    LessonPlans plans;

    @BeforeEach
    void setUp() {
        llm.reset();
        clock.advance(Duration.ofDays(32));
    }

    @Test
    void summarizesThePeriodFromTheLessonsTheirPlansAndTheHomework() {
        UUID plan = UUID.randomUUID();
        when(lessons.ofStudent(STUDENT, FROM, TO)).thenReturn(List.of(
                // 21:30 UTC is 00:30 of the next day in Moscow, the teacher's time zone
                lesson("2026-10-04T21:30:00Z", "Past Simple", null, LessonOutcome.ATTENDED, null,
                        "с".repeat(1_100), "Неправильные глаголы", plan),
                lesson("2026-10-07T15:00:00Z", null, UUID.randomUUID(), LessonOutcome.EXCUSED, null, null, null, null),
                lesson("2026-10-09T15:00:00Z", null, null, LessonOutcome.CANCELLED, CancelledBy.STUDENT, null, null,
                        null),
                lesson("2026-10-11T15:00:00Z", null, null, LessonOutcome.LATE_CANCELLED, CancelledBy.STUDENT, null,
                        null, null),
                lesson("2026-10-13T15:00:00Z", null, null, LessonOutcome.MISSED, null, null, null, null),
                lesson("2026-10-15T15:00:00Z", null, null, LessonOutcome.CANCELLED, CancelledBy.TEACHER, null, null,
                        null),
                lesson("2026-10-30T15:00:00Z", null, null, LessonOutcome.PLANNED, null, null, null, null)));
        when(plans.find(any())).thenReturn(List.of(new LessonPlanView(plan, "План Past Simple", "Тело плана", null,
                false, List.of(
                        new LessonPlanView.Textbook(UUID.randomUUID(), "Spotlight 5", TextbookKind.TEXTBOOK,
                                TextbookFormat.PDF, "12-13"),
                        new LessonPlanView.Textbook(UUID.randomUUID(), "Тетрадь", TextbookKind.TEXTBOOK,
                                TextbookFormat.PDF, null)),
                List.of(video("Routines", "Расшифровка видео"), video(null, null)))));
        when(homework.ofStudent(STUDENT, FROM, TO)).thenReturn(List.of(
                task("Глаголы", "2026-10-05T10:00:00Z", "2026-10-07T10:00:00Z", JournalTask.Status.ACCEPTED,
                        "2026-10-06T10:00:00Z", "5", "к".repeat(600)),
                task("Эссе", "2026-10-06T10:00:00Z", "2026-10-08T10:00:00Z", JournalTask.Status.SUBMITTED,
                        "2026-10-09T10:00:00Z", null, null),
                task("Чтение", "2026-10-10T10:00:00Z", null, JournalTask.Status.ASSIGNED, null, null, null),
                task("Слова", "2026-10-12T10:00:00Z", null, JournalTask.Status.RETURNED, "2026-10-12T12:00:00Z", null,
                        " ")));
        llm.answer("{\"summary\": \"  ### Что прошли\\nPast Simple  \"}", 300, 200);

        assertThat(post("""
                {"studentId": "%s", "from": "2026-10-01", "to": "2026-10-31", "prompt": "Коротко, для родителей",
                 "context": [{"name": "Класс", "value": "7"}]}
                """.formatted(STUDENT))).hasStatusOk().bodyJson().extractingPath("$.summary")
                .isEqualTo("### Что прошли\nPast Simple");

        LlmRequest request = llm.lastRequest();
        assertThat(request.system()).contains("«Что прошли», «Задания», «Получается», «Трудности», «Что дальше»")
                .doesNotContain("{{");
        assertThat(request.prompt())
                .startsWith("Об учениках")
                .contains("<students>\nКласс: 7\n</students>", "Период: с 01.10.2026 по 31.10.2026.",
                        "— 05.10.2026 00:30, 60 мин; тема: Past Simple; был на уроке\n  Что прошли: "
                                + "с".repeat(1_000) + "\n  На следующий урок: Неправильные глаголы\n"
                                + "  План урока: «План Past Simple»; учебники: «Spotlight 5» с. 12-13, «Тетрадь»;"
                                + " видео: «Routines»\n",
                        "— 07.10.2026 18:00, 60 мин, групповой урок; «Урок»; заранее предупредил, что не придёт",
                        "отменён по просьбе ученика", "отменил поздно, засчитан как пропуск", "; пропустил",
                        "отменён учителем", "не отмечен\n</lessons>",
                        "— «Глаголы»: выдано 05.10.2026, срок 07.10.2026; сдано 06.10.2026 вовремя; принято, оценка 5"
                                + "\n  Комментарий учителя: " + "к".repeat(500) + "\n",
                        "— «Эссе»: выдано 06.10.2026, срок 08.10.2026; сдано 09.10.2026 с опозданием; ждёт проверки",
                        "— «Чтение»: выдано 10.10.2026; не сдано",
                        "— «Слова»: выдано 12.10.2026; сдано 12.10.2026 вовремя; возвращено на доработку\n</homework>",
                        "<request>\nКоротко, для родителей\n</request>")
                .doesNotContain("с".repeat(1_001), "к".repeat(501), "Тело плана", "Расшифровка видео", "{{");
        assertThat(request.sources()).isEmpty();
        assertThat(request.schemaName()).isEqualTo("period_summary");
        assertThat(request.schema()).extractingByKey("required").isEqualTo(List.of("summary"));
        assertThat(thisMonth()).singleElement().satisfies(logged -> {
            assertThat(logged.feature()).isEqualTo(AiFeature.PERIOD_SUMMARY);
            assertThat(logged.status()).isEqualTo(RequestStatus.SUCCEEDED);
        });
    }

    @Test
    void keepsTheNewestSixtyLessonsAndTasks() {
        List<JournalLesson> many = new ArrayList<>();
        IntStream.rangeClosed(0, 60).forEach(i -> many.add(lesson(Instant.parse("2026-10-01T06:00:00Z")
                .plus(Duration.ofMinutes(i * 30L)).toString(), "Урок " + i, null, LessonOutcome.ATTENDED, null, null,
                null, null)));
        when(lessons.ofStudent(STUDENT, FROM, TO)).thenReturn(many);
        when(homework.ofStudent(STUDENT, FROM, TO)).thenReturn(IntStream.rangeClosed(0, 60)
                .mapToObj(i -> task("Задание " + i, "2026-10-02T10:00:00Z", null, JournalTask.Status.ASSIGNED, null,
                        null, null))
                .toList());
        llm.answer("{\"summary\": \"Итоги\"}", 1, 1);

        assertThat(post(BODY)).hasStatusOk();

        assertThat(llm.lastRequest().prompt()).contains("тема: Урок 1;", "тема: Урок 60;", "«Задание 1»",
                "«Задание 60»", "<request>\n—\n</request>").doesNotContain("тема: Урок 0;", "«Задание 0»", "<students>");
    }

    @Test
    void anEmptyOrInvalidPeriodAndAnUnusableAnswer() {
        assertThat(post(BODY)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("ai.period-empty");
        assertThat(post(body("2026-10-31", "2026-10-01"))).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson()
                .extractingPath("$.code").isEqualTo("ai.period-invalid");
        assertThat(post(body("2026-01-01", "2026-07-02"))).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson()
                .extractingPath("$.code").isEqualTo("ai.period-invalid");
        assertThat(post(body("2026-01-01", "2026-07-01"))).as("six months are allowed")
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("ai.period-empty");
        assertThat(post("{\"from\": \"2026-10-01\", \"to\": \"2026-10-31\"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post("""
                {"studentId": "%s", "from": "2026-10-01", "to": "2026-10-31", "prompt": "%s"}
                """.formatted(STUDENT, "п".repeat(4_001)))).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(llm.lastRequest()).isNull();

        when(homework.ofStudent(STUDENT, FROM, TO)).thenReturn(List.of(task("Чтение", "2026-10-10T10:00:00Z", null,
                JournalTask.Status.ASSIGNED, null, null, null)));
        llm.answer("{\"summary\": \" \"}", 1, 1);
        assertThat(post(BODY)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("ai.invalid-answer");
        assertThat(llm.lastRequest().prompt()).contains("<lessons>\n—\n</lessons>");
        verifyNoInteractions(plans);
    }

    @Test
    void onlyTheTeacherSummarizesAPeriod() {
        assertThat(mvc.post().uri(URI).with(TestUsers.student(STUDENT))
                .contentType(MediaType.APPLICATION_JSON).content(BODY)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri(URI).with(TestUsers.guardian(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON).content(BODY)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri(URI).with(TestUsers.admin(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON).content(BODY)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri(URI).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(llm.lastRequest()).isNull();
    }

    private static JournalLesson lesson(String startsAt, @Nullable String topic, @Nullable UUID groupId,
            LessonOutcome outcome, @Nullable CancelledBy cancelledBy, @Nullable String summary,
            @Nullable String nextPlan, @Nullable UUID planId) {
        return new JournalLesson(UUID.randomUUID(), Instant.parse(startsAt), 60, groupId == null ? null : "Урок",
                topic, groupId, outcome, cancelledBy, summary, nextPlan, planId, List.of());
    }

    private static JournalTask task(String title, String assignedAt, @Nullable String dueAt,
            JournalTask.Status status, @Nullable String submittedAt, @Nullable String grade,
            @Nullable String comment) {
        return new JournalTask(UUID.randomUUID(), UUID.randomUUID(), title, Instant.parse(assignedAt),
                dueAt == null ? null : Instant.parse(dueAt), status,
                submittedAt == null ? null : Instant.parse(submittedAt), null, grade, comment);
    }

    private static LessonPlanView.Video video(@Nullable String title, @Nullable String transcript) {
        return new LessonPlanView.Video("https://youtu.be/aaaaaaaaaaa", VideoLink.Provider.YOUTUBE, "aaaaaaaaaaa",
                null, title, transcript, false);
    }

    private static String body(String from, String to) {
        return "{\"studentId\": \"%s\", \"from\": \"%s\", \"to\": \"%s\"}".formatted(STUDENT, from, to);
    }

    private MvcTestResult post(String body) {
        return mvc.post().uri(URI).with(TestUsers.teacher(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private List<ru.teacherbox.ai.domain.AiRequest> thisMonth() {
        Instant now = clock.instant();
        return requests.findRecent(now.minus(Duration.ofDays(1)), now.plusSeconds(1), 100);
    }
}
