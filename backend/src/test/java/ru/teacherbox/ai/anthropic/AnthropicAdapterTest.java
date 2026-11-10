package ru.teacherbox.ai.anthropic;

import static org.assertj.core.api.Assertions.assertThat;

import com.anthropic.models.messages.OutputConfig;
import org.junit.jupiter.api.Test;
import ru.teacherbox.ai.AiFixtures;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.ProviderKind;

class AnthropicAdapterTest {

    private final AnthropicAdapter adapter = new AnthropicAdapter();

    @Test
    void buildsAClientOfTheModel() {
        AiProvider provider = AiFixtures.provider(ProviderKind.ANTHROPIC, "key", "https://proxy.example.com");

        LlmClient client = adapter.create(provider, AiFixtures.model(provider, "claude-sonnet-5", "medium", false),
                null);

        assertThat(adapter.kind()).isEqualTo(ProviderKind.ANTHROPIC);
        assertThat(client.provider()).isEqualTo("anthropic");
        assertThat(client.model()).isEqualTo("claude-sonnet-5");
        AiProvider direct = AiFixtures.provider(ProviderKind.ANTHROPIC, "key", null);
        assertThat(adapter.create(direct, AiFixtures.model(direct, "claude-opus-5"), null).model())
                .isEqualTo("claude-opus-5");
    }

    @Test
    void mapsTheEffort() {
        assertThat(AnthropicAdapter.effort(null)).isNull();
        assertThat(AnthropicAdapter.effort("xhigh")).isEqualTo(OutputConfig.Effort.XHIGH);
    }
}
