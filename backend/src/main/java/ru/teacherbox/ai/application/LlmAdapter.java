package ru.teacherbox.ai.application;

import org.jspecify.annotations.Nullable;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.shared.http.OutboundProxy;

/** Builds the clients of one kind of provider (SPI of the adapter packages, ADR-0057). */
public interface LlmAdapter {

    ProviderKind kind();

    /**
     * A client of the model. The key and the address are checked by {@link LlmClients} beforehand: a kind that
     * needs a key has one, an OpenAI-compatible provider has an address.
     *
     * @param proxy the provider's proxy or the default one; {@code null} for direct calls
     */
    LlmClient create(AiProvider provider, AiModel model, @Nullable OutboundProxy proxy);
}
