package ru.teacherbox.platform.admin;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.modulith.events.IncompleteEventPublications;
import org.springframework.modulith.events.core.EventPublicationRegistry;
import org.springframework.modulith.events.core.TargetEventPublication;

/**
 * Domain events that a listener has not processed yet (Event Publication Registry). Only the event type and
 * the listener are shown: the events themselves may contain names and texts.
 */
public class EventPublications {

    /**
     * @param eventType simple class name, e.g. {@code HomeworkSubmitted}
     * @param listener  the listener method that has not completed
     * @param attempts  processing attempts so far
     */
    public record Publication(UUID id, String eventType, String listener, Instant publishedAt, String status,
            int attempts) {
    }

    private final ObjectProvider<EventPublicationRegistry> registry;
    private final ObjectProvider<IncompleteEventPublications> incomplete;

    public EventPublications(ObjectProvider<EventPublicationRegistry> registry,
            ObjectProvider<IncompleteEventPublications> incomplete) {
        this.registry = registry;
        this.incomplete = incomplete;
    }

    /** Oldest first. */
    public List<Publication> incomplete() {
        EventPublicationRegistry events = registry.getIfAvailable();
        if (events == null) {
            return List.of();
        }
        return events.findIncompletePublications().stream()
                .sorted(Comparator.comparing(TargetEventPublication::getPublicationDate))
                .map(publication -> new Publication(publication.getIdentifier(),
                        publication.getEvent().getClass().getSimpleName(),
                        publication.getTargetIdentifier().getValue(), publication.getPublicationDate(),
                        publication.getStatus().name(), publication.getCompletionAttempts()))
                .toList();
    }

    /**
     * Sends the given events to their listeners again (all incomplete ones when {@code ids} is empty).
     *
     * @return how many events were resubmitted
     */
    public int resubmit(Set<UUID> ids) {
        IncompleteEventPublications resubmission = incomplete.getIfAvailable();
        if (resubmission == null) {
            return 0;
        }
        long count = incomplete().stream().filter(publication -> ids.isEmpty() || ids.contains(publication.id()))
                .count();
        resubmission.resubmitIncompletePublications(publication -> ids.isEmpty()
                || ids.contains(publication.getIdentifier()));
        return Math.toIntExact(count);
    }
}
