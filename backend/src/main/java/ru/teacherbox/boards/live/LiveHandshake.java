package ru.teacherbox.boards.live;

import java.util.Map;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;
import ru.teacherbox.boards.application.LiveTickets;
import ru.teacherbox.boards.application.LiveTickets.LivePass;

/** Opens the channel only with a valid ticket ({@code ?ticket=}); anything else gets 403. */
@Component
class LiveHandshake implements HandshakeInterceptor {

    private final LiveTickets tickets;

    LiveHandshake(LiveTickets tickets) {
        this.tickets = tickets;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
            WebSocketHandler handler, Map<String, Object> attributes) {
        String ticket = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams().getFirst("ticket");
        Optional<LivePass> pass = ticket == null ? Optional.empty() : tickets.redeem(ticket);
        if (pass.isEmpty()) {
            response.setStatusCode(HttpStatus.FORBIDDEN);
            return false;
        }
        attributes.put(LiveRooms.PASS, pass.get());
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler,
            @Nullable Exception exception) {
        // Nothing to do: the rooms take the session when it is established.
    }
}
