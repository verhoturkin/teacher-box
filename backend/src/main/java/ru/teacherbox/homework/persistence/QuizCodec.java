package ru.teacherbox.homework.persistence;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;
import ru.teacherbox.homework.domain.quiz.Answer;
import ru.teacherbox.homework.domain.quiz.Matching;
import ru.teacherbox.homework.domain.quiz.MultipleChoice;
import ru.teacherbox.homework.domain.quiz.Numeric;
import ru.teacherbox.homework.domain.quiz.Option;
import ru.teacherbox.homework.domain.quiz.Ordering;
import ru.teacherbox.homework.domain.quiz.Question;
import ru.teacherbox.homework.domain.quiz.QuestionType;
import ru.teacherbox.homework.domain.quiz.ShortText;
import ru.teacherbox.homework.domain.quiz.SingleChoice;

/** JSON columns of questions and answers; the shape per type is fixed here. */
final class QuizCodec {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private QuizCodec() {
    }

    record OptionJson(UUID id, String text) {
    }

    record PairJson(UUID id, String left, String right) {
    }

    record NumberJson(BigDecimal value, BigDecimal tolerance) {
    }

    /** One shape for every answer kind; unused fields are null. */
    record AnswerJson(String kind, @Nullable List<UUID> ids, @Nullable String text, @Nullable Map<UUID, UUID> pairs) {
    }

    /** Column {@code options} of a question. */
    static @Nullable String options(Question question) {
        return switch (question) {
            case SingleChoice q -> optionsJson(q.options());
            case MultipleChoice q -> optionsJson(q.options());
            case Ordering q -> optionsJson(q.items());
            case Matching q -> JSON.writeValueAsString(
                    q.pairs().stream().map(p -> new PairJson(p.id(), p.left(), p.right())).toList());
            case ShortText q -> null;
            case Numeric q -> null;
        };
    }

    /** Column {@code answer} of a question (the key). */
    static @Nullable String key(Question question) {
        return switch (question) {
            case SingleChoice q -> JSON.writeValueAsString(List.of(q.correct()));
            case MultipleChoice q -> JSON.writeValueAsString(q.correct());
            case ShortText q -> JSON.writeValueAsString(q.accepted());
            case Numeric q -> JSON.writeValueAsString(new NumberJson(q.value(), q.tolerance()));
            case Matching q -> null;
            case Ordering q -> null;
        };
    }

    static Question question(UUID id, QuestionType type, String text, int points, @Nullable String explanation,
            @Nullable String options, @Nullable String key) {
        return switch (type) {
            case SINGLE_CHOICE -> new SingleChoice(id, text, points, explanation, optionList(options),
                    read(key, new TypeReference<List<UUID>>() { }).getFirst());
            case MULTIPLE_CHOICE -> new MultipleChoice(id, text, points, explanation, optionList(options),
                    new LinkedHashSet<>(read(key, new TypeReference<List<UUID>>() { })));
            case SHORT_TEXT -> new ShortText(id, text, points, explanation,
                    read(key, new TypeReference<List<String>>() { }));
            case NUMBER -> {
                NumberJson number = read(key, new TypeReference<NumberJson>() { });
                yield new Numeric(id, text, points, explanation, number.value(), number.tolerance());
            }
            case MATCHING -> new Matching(id, text, points, explanation,
                    read(options, new TypeReference<List<PairJson>>() { }).stream()
                            .map(p -> new ru.teacherbox.homework.domain.quiz.Pair(p.id(), p.left(), p.right()))
                            .toList());
            case ORDERING -> new Ordering(id, text, points, explanation, optionList(options));
        };
    }

    static String answer(Answer answer) {
        return JSON.writeValueAsString(switch (answer) {
            case Answer.Choice a -> new AnswerJson("CHOICE", List.copyOf(a.ids()), null, null);
            case Answer.Text a -> new AnswerJson("TEXT", null, a.value(), null);
            case Answer.Number a -> new AnswerJson("NUMBER", null, a.value().toPlainString(), null);
            case Answer.Pairs a -> new AnswerJson("PAIRS", null, null, a.matches());
            case Answer.Order a -> new AnswerJson("ORDER", a.ids(), null, null);
        });
    }

    static Answer answer(String json) {
        AnswerJson a = JSON.readValue(json, AnswerJson.class);
        return switch (a.kind()) {
            case "CHOICE" -> new Answer.Choice(new LinkedHashSet<>(a.ids()));
            case "TEXT" -> new Answer.Text(a.text());
            case "NUMBER" -> new Answer.Number(new BigDecimal(a.text()));
            case "PAIRS" -> new Answer.Pairs(new LinkedHashMap<>(a.pairs()));
            case "ORDER" -> new Answer.Order(a.ids());
            default -> throw new IllegalStateException("Unknown answer kind " + a.kind());
        };
    }

    private static String optionsJson(List<Option> options) {
        return JSON.writeValueAsString(options.stream().map(o -> new OptionJson(o.id(), o.text())).toList());
    }

    private static List<Option> optionList(@Nullable String json) {
        return read(json, new TypeReference<List<OptionJson>>() { }).stream()
                .map(o -> new Option(o.id(), o.text())).toList();
    }

    private static <T> T read(@Nullable String json, TypeReference<T> type) {
        return JSON.readValue(json, type);
    }
}
