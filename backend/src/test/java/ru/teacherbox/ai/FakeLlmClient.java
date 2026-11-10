package ru.teacherbox.ai;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.application.LlmException;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.application.LlmResponse;
import ru.teacherbox.shared.i18n.Language;

/** Scripted language model: answers are queued by the test, requests are remembered. */
public final class FakeLlmClient implements LlmClient {

    private final Deque<Object> answers = new ArrayDeque<>();
    private @Nullable LlmRequest lastRequest;
    private @Nullable LlmException pingError;
    private List<Listed> models = DEFAULT_MODELS;

    /** What {@link #models()} answers until a test says otherwise. */
    public static final List<Listed> DEFAULT_MODELS = List.of(new Listed("fake-model", "Fake model"),
            new Listed("fake-model-2", null));

    public synchronized void answer(String json, long inputTokens, long outputTokens) {
        answers.add(new LlmResponse(json, "fake-model-1", inputTokens, outputTokens));
    }

    public synchronized void fail(LlmException error) {
        answers.add(error);
    }

    public synchronized @Nullable LlmRequest lastRequest() {
        return lastRequest;
    }

    /** The provider's list of models from now on. */
    public synchronized void listModels(List<Listed> listed) {
        models = List.copyOf(listed);
    }

    /** The next pings and lists of models fail with this error ({@code null}: they succeed). */
    public synchronized void failPing(@Nullable LlmException error) {
        pingError = error;
    }

    public synchronized void reset() {
        answers.clear();
        lastRequest = null;
        pingError = null;
        models = DEFAULT_MODELS;
    }

    @Override
    public String provider() {
        return "fake";
    }

    @Override
    public String model() {
        return "fake-model";
    }

    @Override
    public synchronized LlmResponse complete(LlmRequest request) {
        lastRequest = request;
        Object next = answers.poll();
        if (next instanceof LlmException error) {
            throw error;
        }
        if (next instanceof LlmResponse response) {
            return response;
        }
        throw new IllegalStateException("No answer scripted");
    }

    @Override
    public synchronized String ping(Language language) {
        if (pingError != null) {
            throw pingError;
        }
        return language == Language.RU ? "Модель fake-model доступна" : "Model fake-model is available";
    }

    @Override
    public synchronized List<Listed> models() {
        if (pingError != null) {
            throw pingError;
        }
        return models;
    }
}
