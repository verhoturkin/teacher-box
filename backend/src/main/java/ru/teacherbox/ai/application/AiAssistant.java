package ru.teacherbox.ai.application;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import ru.teacherbox.ai.application.AiViews.HomeworkBrief;
import ru.teacherbox.ai.application.AiViews.HomeworkDraft;
import ru.teacherbox.ai.application.AiViews.LessonFacts;
import ru.teacherbox.ai.application.AiViews.LessonPlanBrief;
import ru.teacherbox.ai.application.AiViews.LessonPlanDraft;
import ru.teacherbox.ai.application.AiViews.PeriodSummaryBrief;
import ru.teacherbox.ai.application.AiViews.PeriodSummaryDraft;
import ru.teacherbox.ai.application.AiViews.PlanPages;
import ru.teacherbox.ai.application.AiViews.LessonSummaryBrief;
import ru.teacherbox.ai.application.AiViews.LessonSummaryDraft;
import ru.teacherbox.ai.application.AiViews.ReviewBrief;
import ru.teacherbox.ai.application.AiViews.StudentNote;
import ru.teacherbox.ai.application.AiViews.QuizDraft;
import ru.teacherbox.ai.application.AiViews.ReviewDraft;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.homework.api.QuizDrafts;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.textbooks.api.PageRanges;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * The teacher's assistant: drafts of homework, quizzes, reviews, lesson summaries, lesson plans and period summaries. Answers are always drafts that the
 * teacher edits. No transaction is held while the model is working; every call is logged.
 */
@Service
public class AiAssistant {

    static final String HOMEWORK_PROMPT = "homework-draft.user.v4";
    static final String REVIEW_PROMPT = "review-draft.user.v2";
    static final String LESSON_SUMMARY_PROMPT = "lesson-summary.user.v1";
    static final String QUIZ_PROMPT = "quiz-draft.user.v2";
    static final String LESSON_PLAN_PROMPT = "lesson-plan.user.v1";
    static final String LESSON_PROMPT = "lesson-context.v1";
    static final String PERIOD_SUMMARY_PROMPT = "period-summary.user.v1";
    static final String STUDENTS_PROMPT = "student-context.v1";
    static final int MAX_TITLE = 200;
    /** As a plan of the {@code textbooks} module keeps them. */
    static final int MAX_PLAN_BODY = 20_000;
    static final int MAX_PERIOD_SUMMARY = 20_000;
    /** The longest period a summary covers. */
    static final int MAX_PERIOD_MONTHS = 6;
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    static final Map<String, Object> HOMEWORK_SCHEMA = object(
            "title", property("string", "Короткое название задания"),
            "description", property("string", "Текст задания в Markdown"));
    static final Map<String, Object> REVIEW_SCHEMA = object(
            "comment", property("string", "Черновик отзыва для ученика"),
            "grade", property("string", "Оценка «2»–«5» или пустая строка"),
            "accept", property("boolean", "true — принять работу, false — вернуть на доработку"));

    static final Map<String, Object> QUIZ_SCHEMA = object(
            "questions", array(object(
                    "type", enumeration("SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_TEXT", "NUMBER", "MATCHING",
                            "ORDERING"),
                    "text", property("string", "Текст вопроса в Markdown"),
                    "points", nullable(Map.of("type", "integer"), "Баллы, 1–5"),
                    "explanation", nullable(Map.of("type", "string"), "Почему ответ верный"),
                    "options", nullable(array(property("string", "Вариант или элемент")),
                            "Варианты выбора или элементы упорядочивания в верном порядке"),
                    "correct", nullable(array(property("integer", "Индекс варианта с нуля")),
                            "Индексы верных вариантов"),
                    "accepted", nullable(array(property("string", "Допустимый ответ")), "Допустимые ответы"),
                    "value", nullable(Map.of("type", "number"), "Верное число"),
                    "tolerance", nullable(Map.of("type", "number"), "Допустимое отклонение"),
                    "pairs", nullable(array(object(
                            "left", property("string", "Слева"),
                            "right", property("string", "Справа"))), "Пары соответствия"))));

    static final Map<String, Object> LESSON_SUMMARY_SCHEMA = object(
            "summary", property("string", "Итоги урока в Markdown: что прошли"));

    static final Map<String, Object> LESSON_PLAN_SCHEMA = object(
            "title", property("string", "Короткое название плана, обычно тема урока"),
            "body", property("string", "План урока в Markdown"),
            "textbooks", array(object(
                    "source", property("integer", "Номер учебника из списка в запросе"),
                    "pages", property("string", "Страницы этого учебника, например 12-13, 15"))));

    static final Map<String, Object> PERIOD_SUMMARY_SCHEMA = object(
            "summary", property("string", "Итоги периода в Markdown по разделам"));

    private record PeriodSummaryAnswer(@Nullable String summary) {
    }

    private record PlanAnswer(@Nullable String title, @Nullable String body,
            @Nullable List<@Nullable PagesAnswer> textbooks) {
    }

    private record PagesAnswer(@Nullable Integer source, @Nullable String pages) {
    }

    private record QuizAnswer(@Nullable List<QuizDrafts.Draft> questions) {
    }

    private record LessonSummaryAnswer(@Nullable String summary) {
    }

    private record HomeworkAnswer(@Nullable String title, @Nullable String description) {
    }

    private record ReviewAnswer(@Nullable String comment, @Nullable String grade, @Nullable Boolean accept) {
    }

    private final LlmClients llm;
    private final QuizDrafts quizDrafts;
    private final PromptTemplates prompts;
    private final SystemPrompts systemPrompts;
    private final AiUsage usage;
    private final DraftSources sources;
    private final PeriodFacts periods;
    private final JsonMapper json;

    public AiAssistant(LlmClients llm, PromptTemplates prompts, SystemPrompts systemPrompts,
            AiUsage usage, DraftSources sources, PeriodFacts periods, JsonMapper json, QuizDrafts quizDrafts) {
        this.periods = periods;
        this.quizDrafts = quizDrafts;
        this.llm = llm;
        this.prompts = prompts;
        this.systemPrompts = systemPrompts;
        this.usage = usage;
        this.sources = sources;
        this.json = json;
    }

    /** A draft of homework from the teacher's request and the materials it names. */
    public HomeworkDraft homeworkDraft(HomeworkBrief brief) {
        List<LlmSource> materials = sources.read(brief.sources());
        Map<String, String> values = Map.of(
                "title", orDash(brief.title()),
                "sources", materials.isEmpty() ? "—"
                        : materials.stream().map(LlmSource::name).collect(Collectors.joining("; ")),
                "prompt", brief.prompt().strip(),
                "students", students(brief.context()));
        LlmRequest request = new LlmRequest(
                systemPrompts.text(AiFeature.HOMEWORK_DRAFT),
                prompts.render(HOMEWORK_PROMPT, values),
                "homework_draft",
                HOMEWORK_SCHEMA,
                materials);
        return call(AiFeature.HOMEWORK_DRAFT, brief.modelId(), request, HomeworkAnswer.class, answer -> {
            String title = answer.title() == null ? "" : answer.title().strip();
            String description = answer.description() == null ? "" : answer.description().strip();
            if (title.isEmpty() || description.isEmpty()) {
                return null;
            }
            return new HomeworkDraft(title.length() > MAX_TITLE ? title.substring(0, MAX_TITLE) : title,
                    description);
        });
    }

    /** A draft of quiz questions from the teacher's request and the materials it names. */
    public QuizDraft quizDraft(HomeworkBrief brief) {
        List<LlmSource> materials = sources.read(brief.sources());
        Map<String, String> values = Map.of(
                "sources", materials.isEmpty() ? "—"
                        : materials.stream().map(LlmSource::name).collect(Collectors.joining("; ")),
                "prompt", brief.prompt().strip(),
                "students", students(brief.context()));
        LlmRequest request = new LlmRequest(systemPrompts.text(AiFeature.QUIZ_DRAFT),
                prompts.render(QUIZ_PROMPT, values), "quiz_draft", QUIZ_SCHEMA, materials);
        return call(AiFeature.QUIZ_DRAFT, brief.modelId(), request, QuizAnswer.class, answer -> {
            List<QuizDrafts.Drafted> questions = quizDrafts.validate(
                    answer.questions() == null ? List.of() : answer.questions());
            return questions.isEmpty() ? null : new QuizDraft(questions);
        });
    }

    /**
     * A draft of a lesson plan from the teacher's request, the lesson and the materials it names; the textbook pages
     * of the answer are kept only within the pages sent.
     */
    public LessonPlanDraft lessonPlan(LessonPlanBrief brief) {
        List<DraftSources.Material> materials = sources.materials(brief.sources());
        List<String> textbooks = new ArrayList<>();
        for (int i = 0; i < materials.size(); i++) {
            DraftSources.SentPages sent = materials.get(i).textbook();
            if (sent != null) {
                textbooks.add(i + " — «" + sent.title() + "», с. " + sent.pages().text());
            }
        }
        Map<String, String> values = Map.of(
                "students", students(brief.context()),
                "lesson", lesson(brief.lesson()),
                "course", orDash(brief.courseName()),
                "sources", materials.isEmpty() ? "—"
                        : materials.stream().map(material -> material.source().name())
                                .collect(Collectors.joining("; ")),
                "textbooks", textbooks.isEmpty() ? "—" : String.join("\n", textbooks),
                "prompt", brief.prompt().strip());
        LlmRequest request = new LlmRequest(systemPrompts.text(AiFeature.LESSON_PLAN),
                prompts.render(LESSON_PLAN_PROMPT, values), "lesson_plan", LESSON_PLAN_SCHEMA,
                materials.stream().map(DraftSources.Material::source).toList());
        return call(AiFeature.LESSON_PLAN, brief.modelId(), request, PlanAnswer.class, answer -> {
            String title = answer.title() == null ? "" : answer.title().strip();
            String body = answer.body() == null ? "" : answer.body().strip();
            if (title.isEmpty() || body.isEmpty()) {
                return null;
            }
            return new LessonPlanDraft(cut(title, MAX_TITLE), cut(body, MAX_PLAN_BODY),
                    pages(answer.textbooks(), materials));
        });
    }

    /** The {@code <lesson>} block of the plan's user prompt; empty without a lesson. */
    private String lesson(@Nullable LessonFacts lesson) {
        return lesson == null ? "" : prompts.render(LESSON_PROMPT, Map.of(
                "topic", orDash(lesson.topic()),
                "previousSummary", orDash(lesson.previousSummary()),
                "previousNextPlan", orDash(lesson.previousNextPlan())));
    }

    /**
     * The pages the model pointed at, one entry per textbook in the order named: a source that is not a textbook
     * sent by pages, pages that do not parse or lie outside those sent are dropped.
     */
    private static List<PlanPages> pages(@Nullable List<@Nullable PagesAnswer> answered, List<DraftSources.Material> materials) {
        if (answered == null) {
            return List.of();
        }
        Map<Integer, Set<Integer>> chosen = new LinkedHashMap<>();
        for (PagesAnswer pages : answered) {
            Integer source = pages == null ? null : pages.source();
            if (source == null || source < 0 || source >= materials.size()) {
                continue;
            }
            DraftSources.SentPages sent = materials.get(source).textbook();
            if (sent == null) {
                continue;
            }
            List<Integer> parsed;
            try {
                parsed = PageRanges.parse(pages.pages()).pages();
            } catch (BusinessRuleException e) {
                continue;
            }
            if (sent.pages().pages().containsAll(parsed)) {
                chosen.computeIfAbsent(source, key -> new TreeSet<>()).addAll(parsed);
            }
        }
        return chosen.entrySet().stream().map(entry -> new PlanPages(entry.getKey(),
                Objects.requireNonNull(materials.get(entry.getKey()).textbook()).textbookId(),
                PageRanges.parse(entry.getValue().stream().map(String::valueOf)
                        .collect(Collectors.joining(","))).text())).toList();
    }

    /**
     * A draft of a student's period summary from the lessons and the homework of the period, read on the server; the
     * period is whole days of the instance time zone, at most {@value #MAX_PERIOD_MONTHS} months.
     */
    public PeriodSummaryDraft periodSummary(PeriodSummaryBrief brief) {
        if (brief.to().isBefore(brief.from()) || brief.to().isAfter(brief.from().plusMonths(MAX_PERIOD_MONTHS))) {
            throw new BusinessRuleException("ai.period-invalid",
                    "The period must end after it starts and last at most " + MAX_PERIOD_MONTHS + " months");
        }
        PeriodFacts.Facts facts = periods.of(brief.studentId(), brief.from(), brief.to());
        if (facts.isEmpty()) {
            throw new BusinessRuleException("ai.period-empty", "The student has no lessons or homework in the period");
        }
        Map<String, String> values = Map.of(
                "students", students(brief.context()),
                "from", DAY.format(brief.from()),
                "to", DAY.format(brief.to()),
                "lessons", facts.lessons().isEmpty() ? "—" : facts.lessons(),
                "homework", facts.homework().isEmpty() ? "—" : facts.homework(),
                "prompt", orDash(brief.prompt()));
        LlmRequest request = new LlmRequest(systemPrompts.text(AiFeature.PERIOD_SUMMARY),
                prompts.render(PERIOD_SUMMARY_PROMPT, values), "period_summary", PERIOD_SUMMARY_SCHEMA);
        return call(AiFeature.PERIOD_SUMMARY, brief.modelId(), request, PeriodSummaryAnswer.class, answer -> {
            String summary = answer.summary() == null ? "" : answer.summary().strip();
            return summary.isEmpty() ? null : new PeriodSummaryDraft(cut(summary, MAX_PERIOD_SUMMARY));
        });
    }

    static String cut(String text, int max) {
        return text.length() > max ? text.substring(0, max).strip() : text;
    }

    public ReviewDraft reviewDraft(ReviewBrief brief) {
        Map<String, String> values = Map.of(
                "title", brief.title().strip(),
                "description", orDash(brief.description()),
                "answer", brief.answer().strip(),
                "students", students(brief.context()));
        LlmRequest request = new LlmRequest(systemPrompts.text(AiFeature.REVIEW_DRAFT),
                prompts.render(REVIEW_PROMPT, values), "review_draft", REVIEW_SCHEMA);
        return call(AiFeature.REVIEW_DRAFT, brief.modelId(), request, ReviewAnswer.class, answer -> {
            String comment = answer.comment() == null ? "" : answer.comment().strip();
            if (comment.isEmpty() || answer.accept() == null) {
                return null;
            }
            String grade = answer.grade() == null || answer.grade().isBlank() ? null : answer.grade().strip();
            return new ReviewDraft(comment, grade, answer.accept());
        });
    }

    /** The {@code <students>} block of a user prompt with its rule «defaults; the teacher wins»; empty without notes. */
    private String students(List<StudentNote> context) {
        return context.isEmpty() ? "" : prompts.render(STUDENTS_PROMPT, Map.of("pairs", context.stream()
                .map(note -> note.name().strip() + ": " + note.value().strip())
                .collect(Collectors.joining("\n"))));
    }

    /** A draft of «Что прошли» from the topic, the assignments and the teacher's short words. */
    public LessonSummaryDraft lessonSummary(LessonSummaryBrief brief) {
        Map<String, String> values = Map.of(
                "topic", orDash(brief.topic()),
                "assignments", brief.assignmentTitles().isEmpty() ? "—"
                        : brief.assignmentTitles().stream().map(title -> "— " + title.strip())
                                .collect(Collectors.joining("\n")),
                "words", orDash(brief.words()));
        LlmRequest request = new LlmRequest(systemPrompts.text(AiFeature.LESSON_SUMMARY),
                prompts.render(LESSON_SUMMARY_PROMPT, values), "lesson_summary", LESSON_SUMMARY_SCHEMA);
        return call(AiFeature.LESSON_SUMMARY, brief.modelId(), request, LessonSummaryAnswer.class, answer -> {
            String summary = answer.summary() == null ? "" : answer.summary().strip();
            return summary.isEmpty() ? null : new LessonSummaryDraft(summary);
        });
    }

    private interface Converter<A, T> {
        /** @return {@code null} if the answer is unusable */
        @Nullable T convert(A answer);
    }

    private <A, T> T call(AiFeature feature, @Nullable UUID modelId, LlmRequest request, Class<A> answerType,
            Converter<A, T> converter) {
        LlmClients.ModelClient client = modelId == null
                ? llm.forDefault().orElseThrow(
                        () -> new BusinessRuleException("ai.disabled", "AI is not configured on this instance"))
                : llm.forModel(modelId).orElseThrow(this::unknownModel);
        if (usage.budget().isExhausted()) {
            throw new BusinessRuleException("ai.limit-exceeded", "The monthly AI token limit is reached");
        }
        long started = System.nanoTime();
        LlmResponse response;
        try {
            response = client.client().complete(request);
        } catch (LlmException e) {
            RequestStatus status = e.reason() == LlmException.Reason.REFUSED ? RequestStatus.REFUSED
                    : RequestStatus.FAILED;
            usage.record(feature, client, client.client().model(), status, e.inputTokens(), e.outputTokens(), elapsed(started),
                    e.getMessage());
            throw toDomain(e);
        }
        T result = parse(response.text(), answerType, converter);
        long duration = elapsed(started);
        if (result == null) {
            usage.record(feature, client, response.model(), RequestStatus.FAILED, response.inputTokens(),
                    response.outputTokens(), duration, "The answer does not match the requested format");
            throw toDomain(new LlmException(LlmException.Reason.INVALID_ANSWER, "Invalid answer"));
        }
        usage.record(feature, client, response.model(), RequestStatus.SUCCEEDED, response.inputTokens(),
                response.outputTokens(), duration, null);
        return result;
    }

    /** The model asked for is not configured (removed meanwhile): the problem names the default one, if any. */
    private ConflictException unknownModel() {
        Map<String, Object> properties = llm.forDefault()
                .<Map<String, Object>>map(client -> Map.of("defaultModelId", client.model().id(),
                        "defaultModel", client.model().label()))
                .orElse(Map.of());
        return new ConflictException("ai.model.unknown", "The model is not configured; ask the default one",
                properties);
    }

    private <A, T> @Nullable T parse(String text, Class<A> answerType, Converter<A, T> converter) {
        try {
            A answer = json.readValue(extractJson(text), answerType);
            return answer == null ? null : converter.convert(answer);
        } catch (JacksonException e) {
            return null;
        }
    }

    /** Tolerates Markdown fences or text around the object (some OpenAI-compatible models add them). */
    static String extractJson(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        return start >= 0 && end > start ? text.substring(start, end + 1) : text;
    }

    private static BusinessRuleException toDomain(LlmException e) {
        return switch (e.reason()) {
            case REFUSED -> new BusinessRuleException("ai.refused", "The model declined the request");
            case TRUNCATED -> new BusinessRuleException("ai.truncated", "The answer was cut short");
            case INVALID_ANSWER -> new BusinessRuleException("ai.invalid-answer", "The model returned an unusable answer");
            case UNAVAILABLE -> new BusinessRuleException("ai.unavailable", "The AI provider is unavailable");
        };
    }

    private static String orDash(@Nullable String value) {
        return value == null || value.isBlank() ? "—" : value.strip();
    }

    private static long elapsed(long startedNanos) {
        return Math.max(0, (System.nanoTime() - startedNanos) / 1_000_000);
    }

    private static Map<String, Object> property(String type, String description) {
        Map<String, Object> property = new LinkedHashMap<>();
        property.put("type", type);
        property.put("description", description);
        return Collections.unmodifiableMap(property);
    }

    private static Map<String, Object> array(Map<String, Object> items) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "array");
        schema.put("items", items);
        return Collections.unmodifiableMap(schema);
    }

    private static Map<String, Object> enumeration(String... values) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "string");
        schema.put("enum", List.of(values));
        return Collections.unmodifiableMap(schema);
    }

    /** A property every object must list but may leave {@code null}. */
    private static Map<String, Object> nullable(Map<String, Object> schema, String description) {
        Map<String, Object> property = new LinkedHashMap<>();
        property.put("anyOf", List.of(schema, Map.of("type", "null")));
        property.put("description", description);
        return Collections.unmodifiableMap(property);
    }

    /** An object schema whose properties are all required and no others are allowed. */
    private static Map<String, Object> object(Object... namesAndProperties) {
        Map<String, Object> properties = new LinkedHashMap<>();
        for (int i = 0; i < namesAndProperties.length; i += 2) {
            properties.put((String) namesAndProperties[i], namesAndProperties[i + 1]);
        }
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", Collections.unmodifiableMap(properties));
        schema.put("required", List.copyOf(properties.keySet()));
        schema.put("additionalProperties", false);
        return Collections.unmodifiableMap(schema);
    }
}
