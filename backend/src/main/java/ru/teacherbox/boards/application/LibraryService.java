package ru.teacherbox.boards.application;

import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.boards.domain.SceneElements;
import ru.teacherbox.boards.persistence.LibraryRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * The Excalidraw library of a user (0.7.1): the shapes the teacher or a student keeps for any of their
 * boards. Each user has their own; it is stored whole, as Excalidraw hands it over.
 */
@Service
public class LibraryService {

    /** Most characters of one library. */
    static final int MAX_LIBRARY_CHARS = 2_000_000;

    private final LibraryRepository libraries;
    private final JsonMapper json;
    private final Clock clock;

    public LibraryService(LibraryRepository libraries, JsonMapper json, Clock clock) {
        this.libraries = libraries;
        this.json = json;
        this.clock = clock;
    }

    /** @return the user's library items; an empty array before the first save */
    @Transactional(readOnly = true)
    public JsonNode library(UUID userId) {
        return libraries.find(userId).map(json::readTree).orElseGet(json::createArrayNode);
    }

    /**
     * Replaces the user's library.
     *
     * @throws BusinessRuleException {@code boards.library-invalid} unless every item has an id and
     *                               elements, {@code boards.library-too-large} above the limit
     */
    @Transactional
    public JsonNode save(UUID userId, JsonNode items) {
        if (!items.isArray()) {
            throw invalid();
        }
        for (JsonNode item : items.values()) {
            if (!(item instanceof ObjectNode object) || !object.path("id").isString()
                    || object.path("id").stringValue().isEmpty()
                    || object.path("id").stringValue().length() > SceneElements.MAX_ID
                    || !object.path("elements").isArray()) {
                throw invalid();
            }
        }
        String text = json.writeValueAsString(items);
        if (text.length() > MAX_LIBRARY_CHARS) {
            throw new BusinessRuleException("boards.library-too-large", "The library is too large to save");
        }
        libraries.save(userId, text, clock.instant());
        return items;
    }

    private static BusinessRuleException invalid() {
        return new BusinessRuleException("boards.library-invalid", "Every library item needs an id and elements");
    }
}
