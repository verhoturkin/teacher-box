package ru.teacherbox.homework.application;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import ru.teacherbox.homework.api.QuizDrafts;
import ru.teacherbox.homework.application.HomeworkViews.QuestionView;
import ru.teacherbox.homework.domain.quiz.Matching;
import ru.teacherbox.homework.domain.quiz.MultipleChoice;
import ru.teacherbox.homework.domain.quiz.Numeric;
import ru.teacherbox.homework.domain.quiz.Option;
import ru.teacherbox.homework.domain.quiz.Ordering;
import ru.teacherbox.homework.domain.quiz.Pair;
import ru.teacherbox.homework.domain.quiz.Question;
import ru.teacherbox.homework.domain.quiz.Quiz;
import ru.teacherbox.homework.domain.quiz.QuestionType;
import ru.teacherbox.homework.domain.quiz.ShortText;
import ru.teacherbox.homework.domain.quiz.SingleChoice;
import ru.teacherbox.shared.Ids;

/** Questions drafted by the AI go through the same domain rules as the ones the teacher saves (ADR-0052). */
@Service
class QuizDraftsFacade implements QuizDrafts {

    @Override
    public List<Drafted> validate(List<Draft> drafts) {
        List<Question> valid = new ArrayList<>();
        for (Draft draft : drafts) {
            if (valid.size() == Quiz.MAX_QUESTIONS) {
                break;
            }
            try {
                valid.add(build(draft));
            } catch (RuntimeException e) {
                // a business rule, a bad index, a missing field or an unknown type: the question is dropped
            }
        }
        return valid.stream().map(q -> drafted(QuestionView.of(q))).toList();
    }

    private static Question build(Draft d) {
        UUID id = Ids.newId();
        String text = d.text() == null ? "" : d.text();
        int points = d.points() == null ? 1 : d.points();
        List<Option> options = d.options() == null ? List.of()
                : d.options().stream().map(o -> new Option(Ids.newId(), o)).toList();
        return switch (QuestionType.valueOf(d.type())) {
            case SINGLE_CHOICE -> new SingleChoice(id, text, points, d.explanation(), options,
                    options.get(Objects.requireNonNull(d.correct()).getFirst()).id());
            case MULTIPLE_CHOICE -> new MultipleChoice(id, text, points, d.explanation(), options,
                    new LinkedHashSet<>(Objects.requireNonNull(d.correct()).stream()
                            .map(i -> options.get(i).id()).toList()));
            case SHORT_TEXT -> new ShortText(id, text, points, d.explanation(),
                    d.accepted() == null ? List.of() : d.accepted());
            case NUMBER -> new Numeric(id, text, points, d.explanation(), Objects.requireNonNull(d.value()),
                    d.tolerance() == null ? BigDecimal.ZERO : d.tolerance());
            case MATCHING -> new Matching(id, text, points, d.explanation(), Objects.requireNonNull(d.pairs())
                    .stream().map(p -> new Pair(Ids.newId(), p.left(), p.right())).toList());
            case ORDERING -> new Ordering(id, text, points, d.explanation(), options);
        };
    }

    private static Drafted drafted(QuestionView v) {
        return new Drafted(v.id(), v.type().name(), v.text(), v.points(), v.explanation(),
                v.options().stream().map(o -> new Item(o.id(), o.text())).toList(), v.correct(), v.accepted(),
                v.value(), v.tolerance(),
                v.pairs().stream().map(p -> new DraftedPair(p.id(), p.left(), p.right())).toList());
    }
}
