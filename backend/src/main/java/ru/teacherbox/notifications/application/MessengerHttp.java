package ru.teacherbox.notifications.application;

import java.net.http.HttpClient;
import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** HTTP settings shared by the messenger adapters. */
public final class MessengerHttp {

    /** How long a long polling request waits for new messages. */
    public static final int POLL_TIMEOUT_SECONDS = 25;
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(POLL_TIMEOUT_SECONDS + 20);

    private MessengerHttp() {
    }

    /**
     * A client whose read timeout is longer than a long polling request. HTTP/1.1 is used because the
     * JDK client otherwise tries an h2c upgrade on plain-HTTP endpoints (e.g. a self-hosted Bot API
     * server or a proxy), which some servers break on; long polling gains nothing from HTTP/2. Request
     * bodies are buffered so that they go with {@code Content-Length} instead of chunked encoding.
     */
    public static RestClient client(RestClient.Builder builder, String baseUrl) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(CONNECT_TIMEOUT)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(READ_TIMEOUT);
        return builder.clone()
                .baseUrl(baseUrl)
                .requestFactory(new BufferingClientHttpRequestFactory(requestFactory))
                .build();
    }

    /** Hides a secret (e.g. a token that is part of request URLs) in an error message. */
    public static String redact(@Nullable String message, @Nullable String secret) {
        if (message == null) {
            return "unknown error";
        }
        return secret == null || secret.isEmpty() ? message : message.replace(secret, "***");
    }
}
