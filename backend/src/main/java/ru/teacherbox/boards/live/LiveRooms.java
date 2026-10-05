package ru.teacherbox.boards.live;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator.OverflowStrategy;
import ru.teacherbox.boards.application.BoardAccessChanged;
import ru.teacherbox.boards.application.LiveTickets;
import ru.teacherbox.boards.application.LiveTickets.LivePass;
import ru.teacherbox.boards.application.SceneSaved;
import ru.teacherbox.boards.domain.SceneElements;
import ru.teacherbox.identity.api.GroupArchived;
import ru.teacherbox.identity.api.GroupChanged;
import ru.teacherbox.identity.api.StudentDeactivated;
import ru.teacherbox.shared.error.DomainException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * The editors open on each board (ADR-0029), in the memory of this instance. Each editor is a peer with
 * a name and a colour; the server relays their cursors and changed elements to the others of the board
 * and tells everyone about a new scene version. Nothing is stored: the scene is saved over the API.
 *
 * <p>Messages are JSON objects with {@code type}. From an editor: {@code ping}, {@code pointer}
 * ({@code x}, {@code y}, {@code tool}, {@code button}), {@code elements} ({@code elements}). To it:
 * {@code welcome} ({@code you}, {@code peers}), {@code joined} ({@code peer}), {@code left} ({@code id}),
 * {@code pointer} and {@code elements} with the sender's {@code id}, {@code saved} ({@code sceneVersion}),
 * {@code pong}.
 */
@Component
class LiveRooms {

    /** The session attribute with the ticket's {@link LivePass}. */
    static final String PASS = "boards.live.pass";
    /** Most characters of one message (a scene saves up to 5 M; a live change is a few elements). */
    static final int MAX_MESSAGE_CHARS = 1_000_000;
    static final int SEND_TIME_LIMIT_MS = 5_000;
    static final int SEND_BUFFER_LIMIT = 4 * 1024 * 1024;

    private static final Logger log = LoggerFactory.getLogger(LiveRooms.class);

    /** An open editor. */
    record Peer(String id, LivePass pass, int color, WebSocketSession out) {

        UUID boardId() {
            return pass.boardId();
        }
    }

    private final LiveTickets tickets;
    private final JsonMapper json;
    private final Map<UUID, Map<String, Peer>> rooms = new ConcurrentHashMap<>();
    private final Map<String, Peer> bySession = new ConcurrentHashMap<>();

    LiveRooms(LiveTickets tickets, JsonMapper json) {
        this.tickets = tickets;
        this.json = json;
    }

    synchronized void join(WebSocketSession session) {
        if (!(session.getAttributes().get(PASS) instanceof LivePass pass)) {
            close(session, CloseStatus.POLICY_VIOLATION);
            return;
        }
        session.setTextMessageSizeLimit(MAX_MESSAGE_CHARS);
        Map<String, Peer> room = rooms.computeIfAbsent(pass.boardId(), id -> new ConcurrentHashMap<>());
        Set<Integer> taken = room.values().stream().map(Peer::color).collect(Collectors.toSet());
        int color = 0;
        while (taken.contains(color)) {
            color++;
        }
        Peer peer = new Peer(UUID.randomUUID().toString(), pass, color,
                new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, SEND_BUFFER_LIMIT,
                        OverflowStrategy.DROP));
        ObjectNode welcome = message("welcome").put("you", peer.id());
        welcome.putArray("peers").addAll(room.values().stream().map(this::describe).toList());
        send(peer, welcome);
        relay(peer, room, message("joined").set("peer", describe(peer)));
        room.put(peer.id(), peer);
        bySession.put(session.getId(), peer);
        log.debug("Live board {}: peer {} joined, {} open", pass.boardId(), peer.id(), room.size());
    }

    synchronized void leave(WebSocketSession session) {
        Peer peer = bySession.remove(session.getId());
        if (peer == null) {
            return;
        }
        Map<String, Peer> room = rooms.getOrDefault(peer.boardId(), Map.of());
        room.remove(peer.id());
        if (room.isEmpty()) {
            rooms.remove(peer.boardId());
        }
        relay(peer, room, message("left").put("id", peer.id()));
        log.debug("Live board {}: peer {} left", peer.boardId(), peer.id());
    }

    void receive(WebSocketSession session, String text) {
        Peer peer = bySession.get(session.getId());
        JsonNode message = peer == null ? null : parse(text);
        if (peer == null || message == null) {
            return;
        }
        Map<String, Peer> room = rooms.getOrDefault(peer.boardId(), Map.of());
        switch (message.path("type").asString()) {
            case "ping" -> send(peer, message("pong"));
            case "pointer" -> pointer(peer, message, room);
            case "elements" -> elements(peer, message, room);
            default -> {
                // Unknown messages are ignored: a newer editor may send more.
            }
        }
    }

    /** The editors open on a board. */
    List<Peer> peers(UUID boardId) {
        return List.copyOf(rooms.getOrDefault(boardId, Map.of()).values());
    }

    @TransactionalEventListener(fallbackExecution = true)
    void on(SceneSaved event) {
        ObjectNode saved = message("saved").put("sceneVersion", event.sceneVersion());
        peers(event.boardId()).forEach(peer -> send(peer, saved));
    }

    @TransactionalEventListener(fallbackExecution = true)
    void on(BoardAccessChanged event) {
        recheck(peers(event.boardId()));
    }

    @ApplicationModuleListener
    void on(StudentDeactivated event) {
        allPeers().stream()
                .filter(peer -> peer.pass().user().id().equals(event.studentId()))
                .forEach(peer -> close(peer.out(), CloseStatus.POLICY_VIOLATION));
    }

    @ApplicationModuleListener
    void on(GroupChanged event) {
        recheck(allPeers());
    }

    @ApplicationModuleListener
    void on(GroupArchived event) {
        recheck(allPeers());
    }

    private List<Peer> allPeers() {
        return List.copyOf(bySession.values());
    }

    /** Closes the channels of those who may no longer use their board. */
    private void recheck(List<Peer> peers) {
        peers.stream()
                .filter(peer -> !tickets.mayUse(peer.pass()))
                .forEach(peer -> close(peer.out(), CloseStatus.POLICY_VIOLATION));
    }

    private void pointer(Peer peer, JsonNode message, Map<String, Peer> room) {
        JsonNode x = message.path("x");
        JsonNode y = message.path("y");
        if (!x.isNumber() || !y.isNumber() || !Double.isFinite(x.asDouble()) || !Double.isFinite(y.asDouble())) {
            return;
        }
        relay(peer, room, message("pointer").put("id", peer.id())
                .put("x", x.asDouble())
                .put("y", y.asDouble())
                .put("tool", "laser".equals(message.path("tool").asString()) ? "laser" : "pointer")
                .put("button", "down".equals(message.path("button").asString()) ? "down" : "up"));
    }

    private void elements(Peer peer, JsonNode message, Map<String, Peer> room) {
        JsonNode elements = message.path("elements");
        try {
            SceneElements.valid(elements);
        } catch (DomainException e) {
            return;
        }
        relay(peer, room, message("elements").put("id", peer.id()).set("elements", elements));
    }

    private ObjectNode describe(Peer peer) {
        return json.createObjectNode()
                .put("id", peer.id())
                .put("name", peer.pass().user().displayName())
                .put("color", peer.color());
    }

    private ObjectNode message(String type) {
        return json.createObjectNode().put("type", type);
    }

    private @Nullable JsonNode parse(String text) {
        try {
            JsonNode node = json.readTree(text);
            return node.isObject() ? node : null;
        } catch (JacksonException e) {
            return null;
        }
    }

    /** To everyone on the board but the sender. */
    private void relay(Peer from, Map<String, Peer> room, ObjectNode message) {
        String text = json.writeValueAsString(message);
        room.values().stream().filter(peer -> !peer.id().equals(from.id())).forEach(peer -> send(peer, text));
    }

    private void send(Peer peer, ObjectNode message) {
        send(peer, json.writeValueAsString(message));
    }

    private void send(Peer peer, String text) {
        try {
            peer.out().sendMessage(new TextMessage(text));
        } catch (IOException | RuntimeException e) {
            log.debug("Live board {}: peer {} unreachable", peer.boardId(), peer.id());
            close(peer.out(), CloseStatus.SESSION_NOT_RELIABLE);
        }
    }

    private static void close(WebSocketSession session, CloseStatus status) {
        try {
            session.close(status);
        } catch (IOException | RuntimeException e) {
            // Already gone: afterConnectionClosed cleans up.
        }
    }
}
