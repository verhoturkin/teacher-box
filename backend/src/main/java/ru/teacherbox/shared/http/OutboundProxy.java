package ru.teacherbox.shared.http;

import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import org.jspecify.annotations.Nullable;

/**
 * A proxy for calls to external services that are blocked from the server's network (Telegram,
 * LLM providers). Written as {@code http://host:port} or {@code socks5://host:port}. Proxies with a
 * login and password are not supported: the proxy is expected to run next to the portal (on the
 * host or in a neighbouring container) and to listen on an address closed to the outside.
 */
public record OutboundProxy(Type type, String host, int port) {

    public enum Type {
        HTTP,
        SOCKS
    }

    public OutboundProxy {
        if (host.isBlank()) {
            throw new IllegalArgumentException("Proxy host is empty");
        }
        if (port < 1 || port > 65_535) {
            throw new IllegalArgumentException("Proxy port must be 1-65535");
        }
    }

    /**
     * @param setting value of a {@code *_PROXY} variable
     * @return {@code null} if the setting is empty
     * @throws IllegalArgumentException if the setting is not a supported proxy address
     */
    public static @Nullable OutboundProxy parse(@Nullable String setting) {
        if (setting == null || setting.isBlank()) {
            return null;
        }
        URI uri;
        try {
            uri = new URI(setting.strip());
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Proxy address is not a URL; expected http://host:port or socks5://host:port");
        }
        if (uri.getRawUserInfo() != null) {
            throw new IllegalArgumentException("Proxies with a login and password are not supported; "
                    + "use a proxy without authentication that listens on a private address");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        Type type = switch (scheme) {
            case "http" -> Type.HTTP;
            case "socks", "socks5", "socks5h" -> Type.SOCKS;
            default -> throw new IllegalArgumentException(
                    "Unsupported proxy scheme '" + scheme + "'; expected http://host:port or socks5://host:port");
        };
        if (uri.getHost() == null || uri.getPort() < 0) {
            throw new IllegalArgumentException("Proxy address needs a host and a port, e.g. socks5://127.0.0.1:1080");
        }
        return new OutboundProxy(type, uri.getHost(), uri.getPort());
    }

    /**
     * Reads a proxy setting at startup.
     *
     * @param name environment variable of the setting, for the error message
     * @throws IllegalStateException if the setting is invalid
     */
    public static @Nullable OutboundProxy setting(String name, @Nullable String value) {
        try {
            return parse(value);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(name + ": " + e.getMessage(), e);
        }
    }

    /**
     * The proxy for {@link java.net} and OkHttp clients. The address is left unresolved so that the
     * host is looked up when connecting (a proxy container may get a new address after a restart).
     */
    public Proxy toProxy() {
        return new Proxy(type == Type.HTTP ? Proxy.Type.HTTP : Proxy.Type.SOCKS,
                InetSocketAddress.createUnresolved(host, port));
    }

    @Override
    public String toString() {
        return (type == Type.HTTP ? "http" : "socks5") + "://" + host + ":" + port;
    }
}
