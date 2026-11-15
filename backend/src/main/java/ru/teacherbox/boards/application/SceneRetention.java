package ru.teacherbox.boards.application;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;
import ru.teacherbox.boards.domain.DeletedElement;
import ru.teacherbox.boards.persistence.SceneRepository;
import tools.jackson.databind.node.ObjectNode;

/**
 * Prunes tombstones of deleted elements 30 days after the server first saw them (ADR-0064). The records it
 * keeps grow with the board's history, so it only reads those of the elements at hand, never the whole board.
 * Called under the scene row lock, in the same transaction as its save, restore or nightly pruning.
 */
@Component
public class SceneRetention {
    public static final Duration RETENTION = Duration.ofDays(30);

    private final SceneRepository scenes;
    private final Clock clock;

    public SceneRetention(SceneRepository scenes, Clock clock) {
        this.scenes = scenes;
        this.clock = clock;
    }

    /**
     * The deletion records of these elements, by element id; {@link #prune} keeps the map up to date, so one
     * map serves several prunes of the same elements.
     */
    public Map<String, DeletedElement> deletions(UUID boardId, Stream<ObjectNode> elements) {
        Set<String> ids = elements.map(SceneRetention::id).collect(Collectors.toSet());
        Map<String, DeletedElement> deletions = new HashMap<>();
        scenes.deletions(boardId, ids).forEach(deletion -> deletions.put(deletion.elementId(), deletion));
        return deletions;
    }

    /** Which of these ids are retired: their elements were pruned, an editor may not bring them back. */
    public Set<String> retired(UUID boardId, Collection<String> ids) {
        return scenes.deletions(boardId, ids).stream().filter(DeletedElement::retired)
                .map(DeletedElement::elementId).collect(Collectors.toSet());
    }

    /**
     * Drops the tombstones older than {@link #RETENTION}, records the new ones and forgets the undone ones.
     * Legacy tombstones receive a full retention period on their first observation.
     *
     * @param deletions from {@link #deletions} for (at least) these elements; updated with the records written
     */
    public List<ObjectNode> prune(UUID boardId, List<ObjectNode> elements, Map<String, DeletedElement> deletions) {
        var now = clock.instant();
        var before = now.minus(RETENTION);
        List<ObjectNode> kept = new ArrayList<>();
        for (ObjectNode element : elements) {
            String id = id(element);
            DeletedElement previous = deletions.get(id);
            if (!element.path("isDeleted").asBoolean()) {
                if (previous != null) {
                    scenes.forgetDeletion(boardId, id);
                    deletions.remove(id);
                }
                kept.add(element);
                continue;
            }
            var deletedAt = previous == null ? now : previous.deletedAt();
            boolean retired = deletedAt.isBefore(before);
            DeletedElement deletion = new DeletedElement(id, element.path("version").asLong(), deletedAt, retired);
            if (!deletion.equals(previous)) {
                scenes.deletion(boardId, deletion);
                deletions.put(id, deletion);
            }
            if (!retired) {
                kept.add(element);
            }
        }
        return List.copyOf(kept);
    }

    private static String id(ObjectNode element) {
        return element.path("id").asString();
    }
}
