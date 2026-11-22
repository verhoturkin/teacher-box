package ru.teacherbox.textbooks.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.textbooks.api.VideoLink;
import ru.teacherbox.textbooks.api.VideoTranscripts;

class LessonPlanTest {

    private static final Instant NOW = Instant.parse("2026-11-20T10:00:00Z");
    private static final VideoLink LINK = VideoLink.parse("https://example.com/video");

    @Test
    void aPlanHasATitleAndABoundedText() {
        LessonPlan plan = new LessonPlan(UUID.randomUUID(), "  Урок  ", "  текст ", null, false, null, NOW, NOW, 0);
        assertThat(plan.title()).isEqualTo("Урок");
        assertThat(plan.body()).isEqualTo("текст");

        assertThatThrownBy(() -> new LessonPlan(UUID.randomUUID(), " ", "", null, false, null, NOW, NOW, 0))
                .isInstanceOf(BusinessRuleException.class).hasFieldOrPropertyWithValue("code",
                        "textbooks.plan-title-invalid");
        assertThatThrownBy(() -> new LessonPlan(UUID.randomUUID(), "т".repeat(201), "", null, false, null, NOW, NOW,
                0)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> new LessonPlan(UUID.randomUUID(), "Т", "т".repeat(20_001), null, false, null, NOW,
                NOW, 0)).isInstanceOf(BusinessRuleException.class).hasFieldOrPropertyWithValue("code",
                        "textbooks.plan-body-too-long");
        assertThatThrownBy(() -> new LessonPlan(UUID.randomUUID(), "Т", "", null, true, UUID.randomUUID(), NOW, NOW,
                0)).as("a bank item has no source").isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aCopyKeepsTheContent() {
        UUID course = UUID.randomUUID();
        LessonPlan original = new LessonPlan(UUID.randomUUID(), "Урок", "План", course, true, null, NOW, NOW, 3);
        LessonPlan copy = original.copy(UUID.randomUUID(), false, original.id(), NOW.plusSeconds(1));

        assertThat(copy.title()).isEqualTo("Урок");
        assertThat(copy.courseId()).isEqualTo(course);
        assertThat(copy.bank()).isFalse();
        assertThat(copy.sourceId()).isEqualTo(original.id());
        assertThat(copy.version()).isZero();
    }

    @Test
    void aVideoHasABoundedTitleAndTranscript() {
        UUID plan = UUID.randomUUID();
        PlanVideo video = new PlanVideo(UUID.randomUUID(), plan, 0, LINK, " ", " ", false);
        assertThat(video.title()).isNull();
        assertThat(video.transcript()).isNull();
        assertThat(video.in(UUID.randomUUID(), UUID.randomUUID()).link()).isEqualTo(LINK);

        assertThatThrownBy(() -> new PlanVideo(UUID.randomUUID(), plan, 0, LINK, "т".repeat(201), null, false))
                .isInstanceOf(BusinessRuleException.class).hasFieldOrPropertyWithValue("code", "video.title-invalid");
        assertThatThrownBy(() -> new PlanVideo(UUID.randomUUID(), plan, 0, LINK, null,
                "т".repeat(VideoTranscripts.MAX_TRANSCRIPT + 1), false)).isInstanceOf(BusinessRuleException.class)
                .hasFieldOrPropertyWithValue("code", "video.transcript-too-long");
    }
}
