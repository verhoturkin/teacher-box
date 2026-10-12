package ru.teacherbox.ai.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;

class SavedPromptTest {

    private static final Instant NOW = Instant.parse("2026-10-12T10:00:00Z");

    @Test
    void titleAndTextAreStrippedAndLimited() {
        SavedPrompt prompt = SavedPrompt.create(UUID.randomUUID(), " Тест ", " Сделай тест ", NOW);
        assertThat(prompt.title()).isEqualTo("Тест");
        assertThat(prompt.text()).isEqualTo("Сделай тест");

        prompt.update("Тест 2", "Текст", NOW.plusSeconds(1));
        assertThat(prompt.title()).isEqualTo("Тест 2");
        assertThat(prompt.updatedAt()).isEqualTo(NOW.plusSeconds(1));

        assertThatThrownBy(() -> prompt.update("   ", "Текст", NOW))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("1-100");
        assertThatThrownBy(() -> SavedPrompt.create(UUID.randomUUID(), "x", "y".repeat(4_001), NOW))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("1-4000");
    }
}
