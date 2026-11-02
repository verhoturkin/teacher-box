package ru.teacherbox.platform.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.modulith.events.CompletedEventPublications;
import org.springframework.modulith.events.EventPublication;
import org.springframework.modulith.events.IncompleteEventPublications;
import org.springframework.modulith.events.core.EventPublicationRegistry;
import org.springframework.modulith.events.core.PublicationTargetIdentifier;
import org.springframework.modulith.events.core.TargetEventPublication;

class EventPublicationsTest {

    record SomethingHappened(String secretName) {
    }

    private final EventPublicationRegistry registry = mock(EventPublicationRegistry.class);
    private final IncompleteEventPublications incomplete = mock(IncompleteEventPublications.class);
    private final CompletedEventPublications completed = mock(CompletedEventPublications.class);

    @Test
    void listsIncompleteEventsWithoutTheirContent() {
        TargetEventPublication older = publication("2026-09-25T10:00:00Z");
        TargetEventPublication newer = publication("2026-09-26T10:00:00Z");
        when(registry.findIncompletePublications()).thenReturn(List.of(newer, older));

        assertThat(events().incomplete()).satisfiesExactly(
                first -> {
                    assertThat(first.id()).isEqualTo(older.getIdentifier());
                    assertThat(first.eventType()).isEqualTo("SomethingHappened");
                    assertThat(first.listener()).isEqualTo("ru.teacherbox.notifications.Listener.on");
                    assertThat(first.status()).isEqualTo("FAILED");
                    assertThat(first.attempts()).isEqualTo(3);
                },
                second -> assertThat(second.publishedAt()).isEqualTo(Instant.parse("2026-09-26T10:00:00Z")));
    }

    @SuppressWarnings("unchecked")
    @Test
    void resubmitsTheChosenOrAllEvents() {
        TargetEventPublication chosen = publication("2026-09-25T10:00:00Z");
        TargetEventPublication other = publication("2026-09-26T10:00:00Z");
        when(registry.findIncompletePublications()).thenReturn(List.of(chosen, other));

        assertThat(events().resubmit(Set.of(chosen.getIdentifier()))).isEqualTo(1);
        ArgumentCaptor<Predicate<EventPublication>> filter = ArgumentCaptor.forClass(Predicate.class);
        verify(incomplete).resubmitIncompletePublications(filter.capture());
        assertThat(filter.getValue().test(chosen)).isTrue();
        assertThat(filter.getValue().test(other)).isFalse();

        assertThat(events().resubmit(Set.of())).isEqualTo(2);
    }

    @Test
    void purgesCompletedEventsOlderThanAWeek() {
        events().purgeCompleted();

        verify(completed).deletePublicationsOlderThan(Duration.ofDays(7));
    }

    @Test
    void worksWithoutTheRegistry() {
        StaticListableBeanFactory empty = new StaticListableBeanFactory();
        EventPublications none = new EventPublications(empty.getBeanProvider(EventPublicationRegistry.class),
                empty.getBeanProvider(IncompleteEventPublications.class),
                empty.getBeanProvider(CompletedEventPublications.class));

        assertThat(none.incomplete()).isEmpty();
        assertThat(none.resubmit(Set.of())).isZero();
        none.purgeCompleted();
    }

    private EventPublications events() {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("registry", registry);
        beans.addBean("incomplete", incomplete);
        beans.addBean("completed", completed);
        return new EventPublications(beans.getBeanProvider(EventPublicationRegistry.class),
                beans.getBeanProvider(IncompleteEventPublications.class),
                beans.getBeanProvider(CompletedEventPublications.class));
    }

    private static TargetEventPublication publication(String publishedAt) {
        TargetEventPublication publication = mock(TargetEventPublication.class);
        when(publication.getIdentifier()).thenReturn(UUID.randomUUID());
        when(publication.getEvent()).thenReturn(new SomethingHappened("Аня"));
        when(publication.getTargetIdentifier())
                .thenReturn(PublicationTargetIdentifier.of("ru.teacherbox.notifications.Listener.on"));
        when(publication.getPublicationDate()).thenReturn(Instant.parse(publishedAt));
        when(publication.getStatus()).thenReturn(EventPublication.Status.FAILED);
        when(publication.getCompletionAttempts()).thenReturn(3);
        return publication;
    }
}
