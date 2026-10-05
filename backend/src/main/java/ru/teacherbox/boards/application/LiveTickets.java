package ru.teacherbox.boards.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import ru.teacherbox.boards.domain.Board;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.SecretTokens;

/**
 * One-time tickets to the live channel of a board (ADR-0029): a browser cannot send the access token
 * with a WebSocket, so the editor asks for a ticket over the API and opens the channel with it. A
 * ticket is kept in memory as its hash and lives a minute.
 */
@Service
public class LiveTickets {

    static final Duration TTL = Duration.ofMinutes(1);

    /** Who opens the live channel of which board. */
    public record LivePass(UUID boardId, CurrentUser user) {
    }

    private record Pending(LivePass pass, Instant expiresAt) {
    }

    private final BoardService boards;
    private final Clock clock;
    private final Map<String, Pending> pending = new ConcurrentHashMap<>();

    public LiveTickets(BoardService boards, Clock clock) {
        this.boards = boards;
        this.clock = clock;
    }

    /** A ticket for a user who may open the board; an external board has no live channel. */
    public String issue(CurrentUser user, UUID boardId) {
        Board board = boards.requireAccess(user, boardId);
        if (!board.excalidraw()) {
            throw new ConflictException("boards.no-scene", "An external board has no scene");
        }
        Instant now = clock.instant();
        pending.values().removeIf(ticket -> !ticket.expiresAt().isAfter(now));
        String ticket = SecretTokens.generate();
        pending.put(SecretTokens.hash(ticket), new Pending(new LivePass(board.id(), user), now.plus(TTL)));
        return ticket;
    }

    /** @return who the ticket was issued to; empty for an unknown, used or expired ticket */
    public Optional<LivePass> redeem(String ticket) {
        if (!SecretTokens.isWellFormed(ticket)) {
            return Optional.empty();
        }
        return Optional.ofNullable(pending.remove(SecretTokens.hash(ticket)))
                .filter(found -> found.expiresAt().isAfter(clock.instant()))
                .map(Pending::pass);
    }

    /** Whether the user may still use the board (members change, boards are deleted). */
    public boolean mayUse(LivePass pass) {
        return boards.mayAccess(pass.user(), pass.boardId());
    }
}
