package ru.teacherbox.boards.live;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/** The WebSocket side of the rooms: joins, messages and leaves. */
@Component
class LiveHandler extends TextWebSocketHandler {

    private final LiveRooms rooms;

    LiveHandler(LiveRooms rooms) {
        this.rooms = rooms;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        rooms.join(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        rooms.receive(session, message.getPayload());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        rooms.leave(session);
    }
}
