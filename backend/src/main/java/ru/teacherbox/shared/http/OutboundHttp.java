package ru.teacherbox.shared.http;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

/** HTTP clients for calls to external services (messengers, LLM providers, calendars). */
public final class OutboundHttp {

    private OutboundHttp() {
    }

    /**
     * A request factory for {@code RestClient}. HTTP/1.1 is used everywhere: the JDK client otherwise
     * tries an h2c upgrade on plain-HTTP endpoints (a self-hosted Bot API server, a local model),
     * which some servers break on. Request bodies are buffered so that they go with
     * {@code Content-Length} instead of chunked encoding. Calls through a proxy use
     * {@code HttpURLConnection}, because the JDK {@code HttpClient} cannot talk to SOCKS proxies.
     */
    public static ClientHttpRequestFactory requestFactory(Duration connectTimeout, Duration readTimeout,
            @Nullable OutboundProxy proxy) {
        return new BufferingClientHttpRequestFactory(streamingRequestFactory(connectTimeout, readTimeout, proxy));
    }

    /**
     * Like {@link #requestFactory} but the proxy setting is read on every request (ADR-0056): a live
     * {@code *_PROXY} setting the administrator changes is in force for the next call.
     *
     * @param name    the variable of the setting, e.g. {@code TEACHERBOX_HOMEWORK_YOUTUBE_PROXY}, for the logs
     *                and the error of an invalid value
     * @param setting its current value, e.g. read through {@code shared.settings.LiveProperties}
     */
    public static ClientHttpRequestFactory liveRequestFactory(String name, Supplier<@Nullable String> setting,
            Duration connectTimeout, Duration readTimeout) {
        return new LiveProxyRequestFactory(name, setting, connectTimeout, readTimeout, false);
    }

    /** Like {@link #liveRequestFactory} but bodies are streamed, as {@link #streamingRequestFactory} does. */
    public static ClientHttpRequestFactory liveStreamingRequestFactory(String name,
            Supplier<@Nullable String> setting, Duration connectTimeout, Duration readTimeout) {
        return new LiveProxyRequestFactory(name, setting, connectTimeout, readTimeout, true);
    }

    /**
     * Like {@link #requestFactory} but bodies are streamed, not held in memory: for large uploads and
     * downloads. A request body of known length still goes with {@code Content-Length}.
     */
    public static ClientHttpRequestFactory streamingRequestFactory(Duration connectTimeout, Duration readTimeout,
            @Nullable OutboundProxy proxy) {
        ClientHttpRequestFactory factory;
        if (proxy == null) {
            HttpClient client = HttpClient.newBuilder()
                    .version(HttpClient.Version.HTTP_1_1)
                    .connectTimeout(connectTimeout)
                    .build();
            JdkClientHttpRequestFactory jdk = new JdkClientHttpRequestFactory(client);
            jdk.setReadTimeout(readTimeout);
            factory = jdk;
        } else {
            SimpleClientHttpRequestFactory proxied = new SimpleClientHttpRequestFactory();
            proxied.setProxy(proxy.toProxy());
            proxied.setConnectTimeout(connectTimeout);
            proxied.setReadTimeout(readTimeout);
            factory = proxied;
        }
        return factory;
    }
}
