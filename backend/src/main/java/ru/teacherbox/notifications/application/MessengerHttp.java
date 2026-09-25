package ru.teacherbox.notifications.application;

import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.web.client.RestClient;
import ru.teacherbox.shared.http.OutboundHttp;
import ru.teacherbox.shared.http.OutboundProxy;

/** HTTP settings shared by the messenger adapters. */
public final class MessengerHttp {

    /** How long a long polling request waits for new messages. */
    public static final int POLL_TIMEOUT_SECONDS = 25;
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(POLL_TIMEOUT_SECONDS + 20);

    private MessengerHttp() {
    }

    /** A direct client whose read timeout is longer than a long polling request. */
    public static RestClient client(RestClient.Builder builder, String baseUrl) {
        return client(builder, baseUrl, null);
    }

    /** The same client that goes through a proxy when one is given. */
    public static RestClient client(RestClient.Builder builder, String baseUrl, @Nullable OutboundProxy proxy) {
        return builder.clone()
                .baseUrl(baseUrl)
                .requestFactory(OutboundHttp.requestFactory(CONNECT_TIMEOUT, READ_TIMEOUT, proxy))
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
