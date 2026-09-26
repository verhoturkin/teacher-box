package ru.teacherbox.ai;

import java.util.ArrayDeque;
import java.util.Deque;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.application.LlmException;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.application.LlmResponse;

/** Scripted language model: answers are queued by the test, requests are remembered. */
public final class FakeLlmClient implements LlmClient {

    private final Deque<Object> answers = new ArrayDeque<>();
    private @Nullable LlmRequest lastRequest;
    private @Nullable LlmException pingError;

    public synchronized void answer(String json, long inputTokens, long outputTokens) {
        answers.add(new LlmResponse(json, "fake-model-1", inputTokens, outputTokens));
    }

    public synchronized void fail(LlmException error) {
        answers.add(error);
    }

    public synchronized @Nullable LlmRequest lastRequest() {
        return lastRequest;
    }

    /** The next pings fail with this error ({@code null}: they succeed). */
    public synchronized void failPing(@Nullable LlmException error) {
        pingError = error;
    }

    public synchronized void reset() {
        answers.clear();
        lastRequest = null;
        pingError = null;
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
    public synchronized String ping() {
        if (pingError != null) {
            throw pingError;
        }
        return "Модель fake-model доступна";
    }
}
