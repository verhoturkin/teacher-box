package ru.teacherbox.boards.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.boards.domain.Board;
import ru.teacherbox.boards.domain.BoardFile;
import ru.teacherbox.boards.domain.BoardKind;
import ru.teacherbox.boards.domain.BoardMember;
import ru.teacherbox.boards.domain.BoardScene;
import ru.teacherbox.boards.domain.MemberType;
import ru.teacherbox.boards.persistence.BoardRepository;
import ru.teacherbox.boards.persistence.SceneRepository;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.security.CurrentUser;

/** Boards and who may open them (ADR-0028). */
@Service
public class BoardService {

    static final String NAMESPACE = "boards";

    /** A student or a group of a board; the name is missing when the student or group is gone. */
    public record MemberView(MemberType type, UUID id, @Nullable String name) {
    }

    /** @param updatedAt the last change of the board or of its scene */
    public record BoardView(UUID id, BoardKind kind, String title, @Nullable String url, List<MemberView> members,
            Instant createdAt, Instant updatedAt, long version) {
    }

    /**
     * A board of a student.
     *
     * @param groupNames the student's groups the board is bound to (empty when it is only the student's own)
     */
    public record MyBoardView(UUID id, BoardKind kind, String title, @Nullable String url, List<String> groupNames,
            Instant updatedAt) {
    }

    private final BoardRepository boards;
    private final SceneRepository scenes;
    private final FileStorage storage;
    private final UserDirectory users;
    private final StudentGroups groups;
    private final Clock clock;
    private final ApplicationEventPublisher events;

    public BoardService(BoardRepository boards, SceneRepository scenes, FileStorage storage, UserDirectory users,
            StudentGroups groups, Clock clock, ApplicationEventPublisher events) {
        this.boards = boards;
        this.scenes = scenes;
        this.storage = storage;
        this.users = users;
        this.groups = groups;
        this.clock = clock;
        this.events = events;
    }

    /**
     * All boards, or the boards of some students (their own and those of their current groups), or of one
     * group.
     */
    @Transactional(readOnly = true)
    public List<BoardView> list(Collection<UUID> studentIds, @Nullable UUID groupId) {
        List<Board> found;
        if (!studentIds.isEmpty()) {
            Set<UUID> members = new HashSet<>();
            studentIds.forEach(studentId -> members.addAll(withGroups(studentId).keySet()));
            found = boards.findByIds(boards.findIdsByMembers(members));
        } else if (groupId != null) {
            found = boards.findByIds(boards.findIdsByMembers(List.of(groupId)));
        } else {
            found = boards.findAll();
        }
        return views(found);
    }

    @Transactional
    public BoardView create(BoardKind kind, String title, @Nullable String url, Collection<UUID> studentIds,
            Collection<UUID> groupIds) {
        Instant now = clock.instant();
        Board board = Board.created(Ids.newId(), kind, title, url, now);
        Set<BoardMember> members = members(studentIds, groupIds);
        requireCurrent(members);
        boards.insert(board, members);
        if (board.excalidraw()) {
            scenes.insert(BoardScene.empty(board.id(), now));
        }
        return views(List.of(board)).getFirst();
    }

    /**
     * New members must be current students and active groups; the ones the board already has stay even
     * if they left.
     *
     * @throws OptimisticLockingFailureException if the board was changed after {@code expectedVersion}
     */
    @Transactional
    public BoardView change(UUID boardId, String title, @Nullable String url, Collection<UUID> studentIds,
            Collection<UUID> groupIds, long expectedVersion) {
        Board board = find(boardId);
        if (board.version() != expectedVersion) {
            throw new OptimisticLockingFailureException("Board " + boardId + " was modified");
        }
        Set<BoardMember> members = members(studentIds, groupIds);
        Set<BoardMember> added = new LinkedHashSet<>(members);
        boards.findMembers(boardId).forEach(added::remove);
        requireCurrent(added);
        Board saved = boards.update(board.changed(title, url, clock.instant()), members);
        events.publishEvent(new BoardAccessChanged(boardId));
        return views(List.of(saved)).getFirst();
    }

    /** Deletes the board with its scene, copies and images. */
    @Transactional
    public void remove(UUID boardId) {
        List<BoardFile> files = scenes.findFiles(boardId);
        if (!boards.delete(boardId)) {
            throw notFound();
        }
        files.forEach(file -> storage.delete(NAMESPACE, file.fileKey()));
        events.publishEvent(new BoardAccessChanged(boardId));
    }

    /**
     * The teacher opens any board; a student — a board they are a member of, directly or through a
     * current group. Anyone else gets 404, as if the board did not exist.
     */
    @Transactional(readOnly = true)
    public Board requireAccess(CurrentUser user, UUID boardId) {
        Board board = find(boardId);
        if (mayAccess(user, board)) {
            return board;
        }
        throw notFound();
    }

    /** Like {@link #requireAccess} without an exception (it would mark the caller's transaction for rollback). */
    @Transactional(readOnly = true)
    public boolean mayAccess(CurrentUser user, UUID boardId) {
        return boards.findById(boardId).map(board -> mayAccess(user, board)).orElse(false);
    }

    private boolean mayAccess(CurrentUser user, Board board) {
        if (user.isTeacher()) {
            return true;
        }
        Set<UUID> memberIds = boards.findMembers(board.id()).stream().map(BoardMember::id)
                .collect(Collectors.toSet());
        return memberIds.contains(user.id())
                || groups.groupsOf(user.id()).stream().anyMatch(group -> memberIds.contains(group.id()));
    }

    /** The student's own boards and the boards of their current groups, newest change first. */
    @Transactional(readOnly = true)
    public List<MyBoardView> studentBoards(UUID studentId) {
        Map<UUID, String> mine = withGroups(studentId);
        List<Board> found = boards.findByIds(boards.findIdsByMembers(mine.keySet()));
        Map<UUID, List<BoardMember>> members = boards.findMembers(found.stream().map(Board::id).toList());
        Map<UUID, Instant> changed = scenes.findUpdatedAt(found.stream().map(Board::id).toList());
        return found.stream()
                .map(board -> new MyBoardView(board.id(), board.kind(), board.title(), board.url(),
                        members.getOrDefault(board.id(), List.of()).stream()
                                .filter(member -> member.type() == MemberType.GROUP)
                                .map(member -> mine.get(member.id()))
                                .filter(Objects::nonNull)
                                .toList(),
                        latest(board.updatedAt(), changed.get(board.id()))))
                .sorted(Comparator.comparing(MyBoardView::updatedAt).reversed())
                .toList();
    }

    Board find(UUID boardId) {
        return boards.findById(boardId).orElseThrow(BoardService::notFound);
    }

    static NotFoundException notFound() {
        return new NotFoundException("boards.board-not-found", "Board not found");
    }

    /** The student (with an empty name) and their current groups by id. */
    private Map<UUID, String> withGroups(UUID studentId) {
        Map<UUID, String> ids = groups.groupsOf(studentId).stream()
                .collect(Collectors.toMap(GroupSummary::id, GroupSummary::name));
        ids.put(studentId, "");
        return ids;
    }

    private List<BoardView> views(List<Board> found) {
        List<UUID> ids = found.stream().map(Board::id).toList();
        Map<UUID, List<BoardMember>> members = boards.findMembers(ids);
        Map<UUID, Instant> changed = scenes.findUpdatedAt(ids);
        Set<UUID> memberIds = new HashSet<>();
        members.values().forEach(list -> list.forEach(member -> memberIds.add(member.id())));
        Map<UUID, String> names = new HashMap<>(users.findStudents(memberIds).stream()
                .collect(Collectors.toMap(StudentSummary::id, StudentSummary::displayName)));
        groups.findGroups(memberIds).forEach(group -> names.put(group.id(), group.name()));
        return found.stream()
                .map(board -> new BoardView(board.id(), board.kind(), board.title(), board.url(),
                        members.getOrDefault(board.id(), List.of()).stream()
                                .map(member -> new MemberView(member.type(), member.id(), names.get(member.id())))
                                .toList(),
                        board.createdAt(), latest(board.updatedAt(), changed.get(board.id())), board.version()))
                .toList();
    }

    private static Set<BoardMember> members(Collection<UUID> studentIds, Collection<UUID> groupIds) {
        Set<BoardMember> members = new LinkedHashSet<>();
        studentIds.forEach(id -> members.add(BoardMember.student(id)));
        groupIds.forEach(id -> members.add(BoardMember.group(id)));
        return members;
    }

    private void requireCurrent(Collection<BoardMember> members) {
        List<UUID> studentIds = ids(members, MemberType.STUDENT);
        List<UUID> groupIds = ids(members, MemberType.GROUP);
        Set<UUID> current = users.findStudents(studentIds).stream().filter(StudentSummary::isCurrent)
                .map(StudentSummary::id).collect(Collectors.toSet());
        if (!current.containsAll(studentIds)) {
            throw new NotFoundException("boards.student-not-found", "Student not found");
        }
        Set<UUID> active = groups.findGroups(groupIds).stream().filter(group -> !group.archived())
                .map(GroupSummary::id).collect(Collectors.toSet());
        if (!active.containsAll(groupIds)) {
            throw new NotFoundException("boards.group-not-found", "Group not found");
        }
    }

    private static List<UUID> ids(Collection<BoardMember> members, MemberType type) {
        return members.stream().filter(member -> member.type() == type).map(BoardMember::id).toList();
    }

    private static Instant latest(Instant board, @Nullable Instant scene) {
        return scene != null && scene.isAfter(board) ? scene : board;
    }
}
