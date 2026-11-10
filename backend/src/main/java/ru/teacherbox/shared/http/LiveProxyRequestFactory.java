package ru.teacherbox.shared.http;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.Objects;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.ClientHttpRequest;
import org.springframework.http.client.ClientHttpRequestFactory;

/**
 * A request factory whose proxy is read on every request (ADR-0056): the administrator changes a
 * {@code *_PROXY} setting and the next call goes through the new proxy, without a restart. The factory
 * of the current proxy is kept until the setting changes.
 */
final class LiveProxyRequestFactory implements ClientHttpRequestFactory {

    private static final Logger log = LoggerFactory.getLogger(LiveProxyRequestFactory.class);

    private record Current(@Nullable OutboundProxy proxy, ClientHttpRequestFactory factory) {
    }

    private final String name;
    private final Supplier<@Nullable String> setting;
    private final Duration connectTimeout;
    private final Duration readTimeout;
    private final boolean streaming;
    private volatile @Nullable Current current;

    LiveProxyRequestFactory(String name, Supplier<@Nullable String> setting, Duration connectTimeout,
            Duration readTimeout, boolean streaming) {
        this.name = name;
        this.setting = setting;
        this.connectTimeout = connectTimeout;
        this.readTimeout = readTimeout;
        this.streaming = streaming;
    }

    @Override
    public ClientHttpRequest createRequest(URI uri, HttpMethod httpMethod) throws IOException {
        return factory().createRequest(uri, httpMethod);
    }

    /** The factory of the proxy in force now. */
    ClientHttpRequestFactory factory() {
        OutboundProxy proxy = OutboundProxy.setting(name, setting.get());
        Current known = current;
        if (known != null && Objects.equals(known.proxy(), proxy)) {
            return known.factory();
        }
        if (proxy != null) {
            log.info("{}: requests go through the proxy {}", name, proxy);
        } else if (known != null) {
            log.info("{}: requests go directly", name);
        }
        ClientHttpRequestFactory factory = streaming
                ? OutboundHttp.streamingRequestFactory(connectTimeout, readTimeout, proxy)
                : OutboundHttp.requestFactory(connectTimeout, readTimeout, proxy);
        current = new Current(proxy, factory);
        return factory;
    }
}
