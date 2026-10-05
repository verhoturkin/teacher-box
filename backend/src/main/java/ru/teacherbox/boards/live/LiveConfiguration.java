package ru.teacherbox.boards.live;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * The live channel at {@value #PATH}: under {@code /api/public/**} because a browser cannot send the
 * access token with a WebSocket — the one-time ticket in the address is the authentication. Any origin
 * is allowed for the same reason: no cookie opens the channel, only a ticket the API gave the editor.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSocket
class LiveConfiguration implements WebSocketConfigurer {

    static final String PATH = "/api/public/boards/live";

    private final LiveHandler handler;
    private final LiveHandshake handshake;

    LiveConfiguration(LiveHandler handler, LiveHandshake handshake) {
        this.handler = handler;
        this.handshake = handshake;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, PATH).addInterceptors(handshake).setAllowedOriginPatterns("*");
    }
}
