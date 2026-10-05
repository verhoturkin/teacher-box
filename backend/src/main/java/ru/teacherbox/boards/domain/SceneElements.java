package ru.teacherbox.boards.domain;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * Elements of an Excalidraw scene and their merge (ADR-0028). An element is a JSON object with a
 * string {@code id}, an integral {@code version} and {@code versionNonce}; a deleted element stays as
 * a tombstone ({@code isDeleted: true}) so the deletion does not come back from another editor.
 */
public final class SceneElements {

    public static final int MAX_ID = 100;

    /** The appState keys a board keeps: the rest (zoom, scroll, selection, tool) belongs to each editor. */
    public static final Set<String> APP_STATE_KEYS = Set.of("viewBackgroundColor", "gridSize", "gridStep",
            "gridModeEnabled");

    /**
     * @param elements the merged elements
     * @param changed  whether the incoming elements changed anything
     */
    public record Merge(List<ObjectNode> elements, boolean changed) {
    }

    private SceneElements() {
    }

    /** @throws BusinessRuleException {@code boards.scene-invalid} unless every element is valid */
    public static List<ObjectNode> valid(JsonNode elements) {
        if (!elements.isArray()) {
            throw invalid("The elements must be an array");
        }
        List<ObjectNode> valid = new ArrayList<>(elements.size());
        for (JsonNode element : elements.values()) {
            if (!(element instanceof ObjectNode object) || !object.path("id").isString()
                    || object.path("id").stringValue().isEmpty() || object.path("id").stringValue().length() > MAX_ID
                    || !object.path("version").isIntegralNumber()
                    || !object.path("versionNonce").isIntegralNumber()) {
                throw invalid("Every element needs an id, a version and a versionNonce");
            }
            valid.add(object);
        }
        return valid;
    }

    /** The whitelisted part of an Excalidraw appState. */
    public static ObjectNode appState(JsonNode appState) {
        if (!(appState instanceof ObjectNode object)) {
            throw invalid("The appState must be an object");
        }
        return object.deepCopy().retain(APP_STATE_KEYS);
    }

    /**
     * Merges incoming elements into the stored ones by id, like Excalidraw's {@code reconcileElements}:
     * an incoming element wins with a higher version, or with the same version and a lower versionNonce.
     * Stored elements keep their order; new ones are appended (Excalidraw orders by fractional index).
     */
    public static Merge merge(List<ObjectNode> stored, List<ObjectNode> incoming) {
        Map<String, ObjectNode> merged = byId(stored);
        boolean changed = false;
        for (ObjectNode element : incoming) {
            String id = id(element);
            ObjectNode current = merged.get(id);
            if (current == null || wins(element, current)) {
                merged.put(id, element);
                changed = true;
            }
        }
        return new Merge(List.copyOf(merged.values()), changed);
    }

    /**
     * The scene after restoring a copy: the copy's elements with versions above the current ones, the
     * current elements missing from the copy deleted — so editors that still show the current scene
     * take the restored one instead of saving theirs back over it.
     */
    public static List<ObjectNode> restored(List<ObjectNode> current, List<ObjectNode> copy) {
        Map<String, ObjectNode> now = byId(current);
        Map<String, ObjectNode> restored = new LinkedHashMap<>();
        for (ObjectNode element : copy) {
            ObjectNode was = now.get(id(element));
            long version = Math.max(version(element), was == null ? 0 : version(was)) + 1;
            restored.put(id(element), element.deepCopy().put("version", version));
        }
        for (ObjectNode element : current) {
            if (!restored.containsKey(id(element))) {
                restored.put(id(element), element.path("isDeleted").asBoolean()
                        ? element
                        : element.deepCopy().put("isDeleted", true).put("version", version(element) + 1));
            }
        }
        return List.copyOf(restored.values());
    }

    /** The ids of the images the elements refer to, tombstones included (an undo brings them back). */
    public static Set<String> fileIds(List<ObjectNode> elements) {
        Set<String> ids = new LinkedHashSet<>();
        for (ObjectNode element : elements) {
            JsonNode fileId = element.path("fileId");
            if (fileId.isString()) {
                ids.add(fileId.stringValue());
            }
        }
        return ids;
    }

    private static boolean wins(ObjectNode incoming, ObjectNode current) {
        long incomingVersion = version(incoming);
        long currentVersion = version(current);
        return incomingVersion > currentVersion || incomingVersion == currentVersion
                && incoming.path("versionNonce").asLong() < current.path("versionNonce").asLong();
    }

    private static Map<String, ObjectNode> byId(List<ObjectNode> elements) {
        Map<String, ObjectNode> byId = new LinkedHashMap<>();
        elements.forEach(element -> byId.put(id(element), element));
        return byId;
    }

    private static String id(ObjectNode element) {
        return element.path("id").stringValue();
    }

    private static long version(ObjectNode element) {
        return element.path("version").asLong();
    }

    private static BusinessRuleException invalid(String message) {
        return new BusinessRuleException("boards.scene-invalid", message);
    }
}
