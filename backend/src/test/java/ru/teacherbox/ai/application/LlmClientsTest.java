package ru.teacherbox.ai.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import ru.teacherbox.ai.AiFixtures;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.AiSettings;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.ai.persistence.ProviderRepository;
import ru.teacherbox.shared.http.OutboundProxy;
import ru.teacherbox.shared.i18n.Language;

/** One client per provider and model, built when asked for and built anew after a change (ADR-0057). */
class LlmClientsTest {

    private final ProviderRepository repository = mock(ProviderRepository.class);
    private final MockEnvironment environment = new MockEnvironment();
    private final Recording adapter = new Recording(ProviderKind.OPENAI_COMPATIBLE);
    private final LlmClients clients = new LlmClients(repository,
            List.of(adapter, new Recording(ProviderKind.OPENAI_COMPATIBLE), new Recording(ProviderKind.GEMINI)),
            environment);

    private AiProvider provider = AiFixtures.provider(ProviderKind.OPENAI_COMPATIBLE, null, "http://local/v1");
    private AiModel model = AiFixtures.model(provider, "llama3");

    @BeforeEach
    void store() {
        when(repository.settings()).thenReturn(AiSettings.NONE);
        stored(provider, model);
    }

    @Test
    void theAiIsOffWithoutADefaultModel() {
        assertThat(clients.forDefault()).isEmpty();

        when(repository.settings()).thenReturn(new AiSettings(model.id(), 10, 1));
        assertThat(clients.forDefault()).get().satisfies(found -> {
            assertThat(found.model()).isEqualTo(model);
            assertThat(found.provider()).isEqualTo(provider);
            assertThat(found.client().model()).isEqualTo("llama3");
        });
    }

    @Test
    void anUnknownModelOrProviderHasNoClient() {
        UUID unknown = UUID.randomUUID();
        when(repository.findModel(unknown)).thenReturn(Optional.empty());
        assertThat(clients.forModel(unknown)).isEmpty();

        when(repository.findProvider(provider.id())).thenReturn(Optional.empty());
        assertThat(clients.forModel(model.id())).isEmpty();
    }

    @Test
    void keepsTheClientUntilTheProviderTheModelOrTheProxyChanges() {
        LlmClient first = client();
        assertThat(client()).isSameAs(first);
        assertThat(adapter.proxies).containsExactly((OutboundProxy) null);

        stored(new AiProvider(provider.id(), provider.kind(), "Renamed", null, provider.baseUrl(), null, 0, 1), model);
        LlmClient afterProvider = client();
        assertThat(afterProvider).isNotSameAs(first);

        stored(provider, new AiModel(model.id(), provider.id(), "qwen3", "qwen3", null, true, 1, model.timeout(), 0, 1));
        LlmClient afterModel = client();
        assertThat(afterModel).isNotSameAs(afterProvider);
        assertThat(afterModel.model()).isEqualTo("qwen3");

        environment.setProperty("teacherbox.ai.proxy", "socks5://vpn:1080");
        LlmClient afterProxy = client();
        assertThat(afterProxy).isNotSameAs(afterModel);
        assertThat(client()).isSameAs(afterProxy);
        assertThat(adapter.proxies).last().hasToString("socks5://vpn:1080");

        stored(new AiProvider(provider.id(), provider.kind(), "Own proxy", null, provider.baseUrl(),
                "http://own:3128", 0, 2), model);
        client();
        assertThat(adapter.proxies).last().as("the provider's own proxy wins").hasToString("http://own:3128");
    }

    @Test
    void aProviderThatCannotBeCalledFailsEveryCallWithTheReason() {
        assertBroken(AiFixtures.provider(ProviderKind.ANTHROPIC, null, null), "The provider has no API key");
        assertBroken(AiFixtures.provider(ProviderKind.OPENAI_COMPATIBLE, null, null), "The provider has no API address");
        assertBroken(AiFixtures.provider(ProviderKind.DEEPSEEK, "key", null), "No adapter for deepseek");
        assertBroken(AiFixtures.provider(ProviderKind.GEMINI, "key", null, "ftp://vpn:21"),
                "Proxy: Unsupported proxy scheme 'ftp'; expected http://host:port or socks5://host:port");
    }

    @Test
    void closesTheClientsItKeepsWhenThePortalStops() {
        Recording.Client built = (Recording.Client) client();
        AiProvider broken = AiFixtures.provider(ProviderKind.ANTHROPIC, null, null);
        AiModel brokenModel = AiFixtures.model(broken, "m");
        AiProvider keptProvider = provider;
        AiModel kept = model;
        stored(broken, brokenModel);
        clients.forModel(brokenModel.id());

        clients.destroy();

        assertThat(built.closed).isTrue();
        stored(keptProvider, kept);
        assertThat(client()).isNotSameAs(built);
        clients.destroy();
    }

    private void assertBroken(AiProvider broken, String reason) {
        AiModel brokenModel = AiFixtures.model(broken, "m");
        stored(broken, brokenModel);
        LlmClient client = clients.forModel(brokenModel.id()).orElseThrow().client();

        assertThat(client.provider()).isEqualTo(broken.kind().id());
        assertThat(client.model()).isEqualTo("m");
        assertThatThrownBy(() -> client.complete(new LlmRequest("s", "p", "n", java.util.Map.of())))
                .isInstanceOfSatisfying(LlmException.class, e -> {
                    assertThat(e.reason()).isEqualTo(LlmException.Reason.UNAVAILABLE);
                    assertThat(e).hasMessage(reason);
                });
        assertThatThrownBy(() -> client.ping(Language.RU)).hasMessage(reason);
    }

    private LlmClient client() {
        return clients.forModel(model.id()).orElseThrow().client();
    }

    private void stored(AiProvider storedProvider, AiModel storedModel) {
        provider = storedProvider;
        model = storedModel;
        when(repository.findProvider(storedProvider.id())).thenReturn(Optional.of(storedProvider));
        when(repository.findModel(storedModel.id())).thenReturn(Optional.of(storedModel));
    }

    private static final class Recording implements LlmAdapter {

        private final ProviderKind kind;
        private final List<@Nullable OutboundProxy> proxies = new ArrayList<>();

        Recording(ProviderKind kind) {
            this.kind = kind;
        }

        @Override
        public ProviderKind kind() {
            return kind;
        }

        @Override
        public LlmClient create(AiProvider provider, AiModel model, @Nullable OutboundProxy proxy) {
            proxies.add(proxy);
            return new Client(model.modelId());
        }

        private static final class Client implements LlmClient, AutoCloseable {

            private final String model;
            private boolean closed;

            Client(String model) {
                this.model = model;
            }

            @Override
            public String provider() {
                return "recording";
            }

            @Override
            public String model() {
                return model;
            }

            @Override
            public LlmResponse complete(LlmRequest request) {
                return new LlmResponse("{}", model, 0, 0);
            }

            @Override
            public String ping(Language language) {
                return "ok";
            }

            @Override
            public void close() {
                closed = true;
            }
        }
    }
}
