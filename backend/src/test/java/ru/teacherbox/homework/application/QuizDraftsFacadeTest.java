package ru.teacherbox.homework.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import ru.teacherbox.homework.api.QuizDrafts.Draft;
import ru.teacherbox.homework.api.QuizDrafts.DraftPair;
import ru.teacherbox.homework.api.QuizDrafts.Drafted;

class QuizDraftsFacadeTest {

    private final QuizDraftsFacade facade = new QuizDraftsFacade();

    private static Draft draft(String type, List<String> options, List<Integer> correct, List<String> accepted,
            BigDecimal value, List<DraftPair> pairs) {
        return new Draft(type, "Вопрос", null, "Потому что", options, correct, accepted, value, null, pairs);
    }

    @Test
    void validQuestionsOfAllTypesGetIds() {
        List<String> abc = List.of("a", "b", "c");
        List<Drafted> result = facade.validate(List.of(
                draft("SINGLE_CHOICE", abc, List.of(1), null, null, null),
                draft("MULTIPLE_CHOICE", abc, List.of(0, 2), null, null, null),
                draft("SHORT_TEXT", null, null, List.of("кот"), null, null),
                draft("NUMBER", null, null, null, BigDecimal.TEN, null),
                draft("MATCHING", null, null, null, null,
                        List.of(new DraftPair("1", "one"), new DraftPair("2", "two"))),
                draft("ORDERING", abc, null, null, null, null)));

        assertThat(result).extracting(Drafted::type).containsExactly("SINGLE_CHOICE", "MULTIPLE_CHOICE",
                "SHORT_TEXT", "NUMBER", "MATCHING", "ORDERING");
        assertThat(result.getFirst().correct()).containsExactly(result.getFirst().options().get(1).id());
        assertThat(result.getFirst().points()).isEqualTo(1);
        assertThat(result.get(3).tolerance()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.get(4).pairs()).hasSize(2);
    }

    @Test
    void invalidQuestionsAreDropped() {
        List<String> abc = List.of("a", "b", "c");
        List<Drafted> result = facade.validate(List.of(
                draft("SINGLE_CHOICE", abc, List.of(5), null, null, null),
                draft("SINGLE_CHOICE", abc, List.of(), null, null, null),
                draft("MULTIPLE_CHOICE", abc, null, null, null, null),
                draft("SHORT_TEXT", null, null, List.of(), null, null),
                draft("NUMBER", null, null, null, null, null),
                draft("MATCHING", null, null, null, null, null),
                draft("ORDERING", List.of("only"), null, null, null, null),
                draft("POETRY", abc, null, null, null, null),
                new Draft("SHORT_TEXT", " ", 1, null, null, null, List.of("x"), null, null, null),
                draft("ORDERING", abc, null, null, null, null)));

        assertThat(result).extracting(Drafted::type).containsExactly("ORDERING");
    }

    @Test
    void atMostFiftyQuestions() {
        List<Draft> many = java.util.Collections.nCopies(60,
                draft("SHORT_TEXT", null, null, List.of("x"), null, null));

        assertThat(facade.validate(many)).hasSize(50);
    }
}
