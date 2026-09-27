package ru.teacherbox.boards.application;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.boards.domain.Board;
import ru.teacherbox.boards.domain.BoardOwner;
import ru.teacherbox.boards.persistence.BoardRepository;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/** Boards of students and groups (ADR-0012). */
@Service
public class BoardService {

    /** Most boards of one student or group. */
    static final int MAX_PER_OWNER = 20;

    /**
     * @param ownerName the student's or the group's name
     * @param holst     the link opens a Holst board
     */
    public record BoardView(UUID id, BoardOwner ownerType, UUID ownerId, @Nullable String ownerName, String title,
            String url, boolean holst, long version) {
    }

    /** A board of the student or of one of their groups. */
    public record MyBoardView(UUID id, BoardOwner ownerType, @Nullable String groupName, String title, String url,
            boolean holst) {
    }

    private final BoardRepository boards;
    private final UserDirectory users;
    private final StudentGroups groups;
    private final Clock clock;

    public BoardService(BoardRepository boards, UserDirectory users, StudentGroups groups, Clock clock) {
        this.boards = boards;
        this.users = users;
        this.groups = groups;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<BoardView> list() {
        List<Board> all = boards.findAll();
        Map<UUID, String> names = names(all.stream().map(Board::ownerId).distinct().toList());
        return all.stream().map(board -> view(board, names.get(board.ownerId()))).toList();
    }

    @Transactional
    public BoardView add(BoardOwner ownerType, UUID ownerId, @Nullable String title, String url) {
        String name = requireOwner(ownerType, ownerId);
        if (boards.findByOwners(List.of(ownerId)).size() >= MAX_PER_OWNER) {
            throw new BusinessRuleException("boards.too-many",
                    "At most " + MAX_PER_OWNER + " boards per student or group");
        }
        Board board = Board.added(Ids.newId(), ownerType, ownerId, title, url, clock.instant());
        boards.insert(board);
        return view(board, name);
    }

    /** @throws OptimisticLockingFailureException if the board was changed after {@code expectedVersion} */
    @Transactional
    public BoardView change(UUID boardId, String title, String url, long expectedVersion) {
        Board board = find(boardId);
        if (board.version() != expectedVersion) {
            throw new OptimisticLockingFailureException("Board " + boardId + " was modified");
        }
        Board saved = boards.update(board.changed(title, url, clock.instant()));
        return view(saved, names(List.of(saved.ownerId())).get(saved.ownerId()));
    }

    @Transactional
    public void remove(UUID boardId) {
        if (!boards.delete(boardId)) {
            throw notFound();
        }
    }

    /** The student's own boards and the boards of their current groups. */
    @Transactional(readOnly = true)
    public List<MyBoardView> studentBoards(UUID studentId) {
        List<GroupSummary> own = groups.groupsOf(studentId);
        Map<UUID, String> groupNames = own.stream().collect(Collectors.toMap(GroupSummary::id, GroupSummary::name));
        List<UUID> owners = new ArrayList<>();
        owners.add(studentId);
        owners.addAll(groupNames.keySet());
        return boards.findByOwners(owners).stream()
                .map(board -> new MyBoardView(board.id(), board.ownerType(), groupNames.get(board.ownerId()),
                        board.title(), board.url(), board.holst()))
                .toList();
    }

    private String requireOwner(BoardOwner ownerType, UUID ownerId) {
        return switch (ownerType) {
            case STUDENT -> users.findStudent(ownerId).filter(StudentSummary::isCurrent)
                    .map(StudentSummary::displayName)
                    .orElseThrow(() -> new NotFoundException("boards.student-not-found", "Student not found"));
            case GROUP -> groups.findGroup(ownerId).filter(group -> !group.archived())
                    .map(GroupSummary::name)
                    .orElseThrow(() -> new NotFoundException("boards.group-not-found", "Group not found"));
        };
    }

    private Map<UUID, String> names(Collection<UUID> ownerIds) {
        Map<UUID, String> names = users.findStudents(ownerIds).stream()
                .collect(Collectors.toMap(StudentSummary::id, StudentSummary::displayName));
        groups.findGroups(ownerIds).forEach(group -> names.put(group.id(), group.name()));
        return names;
    }

    private Board find(UUID boardId) {
        return boards.findById(boardId).orElseThrow(BoardService::notFound);
    }

    private static BoardView view(Board board, @Nullable String name) {
        return new BoardView(board.id(), board.ownerType(), board.ownerId(), name, board.title(), board.url(),
                board.holst(), board.version());
    }

    private static NotFoundException notFound() {
        return new NotFoundException("boards.board-not-found", "Board not found");
    }
}
