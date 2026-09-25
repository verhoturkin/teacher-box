package ru.teacherbox.ai.anthropic;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.anthropic.models.messages.OutputConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import ru.teacherbox.ai.application.AiProperties;

class AnthropicConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(PropertiesConfiguration.class, AnthropicConfiguration.class);

    @Test
    void enabledByProvider() {
        runner.run(context -> assertThat(context).doesNotHaveBean(AnthropicLlmClient.class));
        runner.withPropertyValues("teacherbox.ai.provider=openai-compatible")
                .run(context -> assertThat(context).doesNotHaveBean(AnthropicLlmClient.class));
        runner.withPropertyValues("teacherbox.ai.provider= Anthropic ", "teacherbox.ai.api-key=key",
                        "teacherbox.ai.base-url=https://proxy.example.com")
                .run(context -> {
                    assertThat(context).hasSingleBean(AnthropicLlmClient.class);
                    assertThat(context.getBean(AnthropicLlmClient.class).model())
                            .isEqualTo(AiProperties.DEFAULT_ANTHROPIC_MODEL);
                });
        runner.withPropertyValues("teacherbox.ai.provider=anthropic", "teacherbox.ai.api-key=key",
                        "teacherbox.ai.model=claude-sonnet-5", "teacherbox.ai.effort=medium")
                .run(context -> assertThat(context.getBean(AnthropicLlmClient.class).model())
                        .isEqualTo("claude-sonnet-5"));
    }

    @Test
    void requiresAnApiKeyAndAValidEffort() {
        runner.withPropertyValues("teacherbox.ai.provider=anthropic", "teacherbox.ai.api-key=")
                .run(context -> assertThat(context).hasFailed().getFailure()
                        .hasRootCauseMessage("TEACHERBOX_AI_API_KEY is required for the anthropic provider"));
        runner.withPropertyValues("teacherbox.ai.provider=anthropic", "teacherbox.ai.api-key=key",
                        "teacherbox.ai.effort=extreme")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void parsesEffort() {
        assertThat(AnthropicConfiguration.effort(null)).isNull();
        assertThat(AnthropicConfiguration.effort(" ")).isNull();
        assertThat(AnthropicConfiguration.effort(" XHigh ")).isEqualTo(OutputConfig.Effort.XHIGH);
        assertThatThrownBy(() -> AnthropicConfiguration.effort("fast")).isInstanceOf(IllegalStateException.class);
    }

    @EnableConfigurationProperties(AiProperties.class)
    static class PropertiesConfiguration {
    }
}
