package ru.teacherbox.boards.application;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import ru.teacherbox.boards.domain.DeletedElement;
import ru.teacherbox.boards.persistence.SceneRepository;
import tools.jackson.databind.node.ObjectNode;

/** Called under the scene row lock, in the same transaction as its save or restore. */
@Component
public class SceneRetention {
    public static final Duration RETENTION = Duration.ofDays(30);

    private final SceneRepository scenes;
    private final Clock clock;

    public SceneRetention(SceneRepository scenes, Clock clock) {
        this.scenes = scenes;
        this.clock = clock;
    }

    public Map<String, DeletedElement> deletions(UUID boardId) {
        return scenes.deletions(boardId).stream()
                .collect(Collectors.toMap(DeletedElement::elementId, Function.identity()));
    }

    /** Legacy tombstones receive a full retention period on their first observation. */
    public List<ObjectNode> prune(UUID boardId, List<ObjectNode> elements,
            Map<String, DeletedElement> deletions) {
        var now = clock.instant();
        var before = now.minus(RETENTION);
        List<ObjectNode> kept = new ArrayList<>();
        for (ObjectNode element : elements) {
            String id = element.path("id").asString();
            DeletedElement previous = deletions.get(id);
            if (!element.path("isDeleted").asBoolean()) {
                if (previous != null) {
                    scenes.forgetDeletion(boardId, id);
                }
                kept.add(element);
                continue;
            }
            var deletedAt = previous == null ? now : previous.deletedAt();
            boolean retired = deletedAt.isBefore(before);
            DeletedElement deletion = new DeletedElement(id, element.path("version").asLong(), deletedAt, retired);
            if (!deletion.equals(previous)) {
                scenes.deletion(boardId, deletion);
            }
            if (!retired) {
                kept.add(element);
            }
        }
        return List.copyOf(kept);
    }
}
