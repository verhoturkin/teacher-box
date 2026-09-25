package ru.teacherbox.shared.http;

import java.net.http.HttpClient;
import java.time.Duration;
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
        return new BufferingClientHttpRequestFactory(factory);
    }
}
