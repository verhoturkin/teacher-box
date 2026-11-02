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
import ru.teacherbox.homework.domain.quiz.QuestionDraft;
import ru.teacherbox.homework.domain.quiz.QuestionDraft.Item;
import ru.teacherbox.homework.domain.quiz.QuestionDraft.Match;
import ru.teacherbox.homework.domain.quiz.QuestionType;

/** JSON columns of questions and answers; the shape per type is fixed here. */
final class QuizCodec {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private QuizCodec() {
    }

    record OptionJson(UUID id, String text) {
    }

    record PairJson(UUID id, String left, String right) {
    }

    record NumberJson(@Nullable BigDecimal value, @Nullable BigDecimal tolerance) {
    }

    /** One shape for every answer kind; unused fields are null. */
    record AnswerJson(String kind, @Nullable List<UUID> ids, @Nullable String text, @Nullable Map<UUID, UUID> pairs) {
    }

    /** Column {@code options} of a question. */
    static @Nullable String options(QuestionDraft question) {
        return switch (question.type()) {
            case SINGLE_CHOICE, MULTIPLE_CHOICE, ORDERING -> JSON.writeValueAsString(
                    question.options().stream().map(o -> new OptionJson(o.id(), o.text())).toList());
            case MATCHING -> JSON.writeValueAsString(
                    question.pairs().stream().map(p -> new PairJson(p.id(), p.left(), p.right())).toList());
            case SHORT_TEXT, NUMBER -> null;
        };
    }

    /** Column {@code answer} of a question (the key). */
    static @Nullable String key(QuestionDraft question) {
        return switch (question.type()) {
            case SINGLE_CHOICE, MULTIPLE_CHOICE -> JSON.writeValueAsString(question.correct());
            case SHORT_TEXT -> JSON.writeValueAsString(question.accepted());
            case NUMBER -> JSON.writeValueAsString(new NumberJson(question.value(), question.tolerance()));
            case MATCHING, ORDERING -> null;
        };
    }

    /** A stored question; a draft assignment may hold an incomplete one (ADR-0054). */
    static QuestionDraft question(UUID id, QuestionType type, String text, int points, @Nullable String explanation,
            @Nullable String options, @Nullable String key) {
        List<Item> items = List.of();
        List<UUID> correct = List.of();
        List<String> accepted = List.of();
        NumberJson number = new NumberJson(null, null);
        List<Match> pairs = List.of();
        switch (type) {
            case SINGLE_CHOICE, MULTIPLE_CHOICE -> {
                items = items(options);
                correct = read(key, new TypeReference<List<UUID>>() { });
            }
            case ORDERING -> items = items(options);
            case SHORT_TEXT -> accepted = read(key, new TypeReference<List<String>>() { });
            case NUMBER -> number = read(key, new TypeReference<NumberJson>() { });
            case MATCHING -> pairs = read(options, new TypeReference<List<PairJson>>() { }).stream()
                    .map(p -> new Match(p.id(), p.left(), p.right())).toList();
        }
        return new QuestionDraft(id, type, text, points, explanation, items, correct, accepted, number.value(),
                number.tolerance(), pairs);
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

    private static List<Item> items(@Nullable String json) {
        return read(json, new TypeReference<List<OptionJson>>() { }).stream()
                .map(o -> new Item(o.id(), o.text())).toList();
    }

    private static <T> T read(@Nullable String json, TypeReference<T> type) {
        return JSON.readValue(json, type);
    }
}
