package ru.teacherbox.schedule.google;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.schedule.api.GoogleCalendarDisconnected;
import ru.teacherbox.schedule.application.ScheduleProperties;
import ru.teacherbox.schedule.domain.FeedTokens;
import ru.teacherbox.schedule.domain.GoogleConnection;
import ru.teacherbox.schedule.domain.GoogleStatus;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.persistence.GoogleRepository;
import ru.teacherbox.schedule.persistence.GoogleRepository.PendingAuthorization;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/**
 * Connection to the teacher's Google Calendar (OAuth, web server flow) and one-way sync: lessons
 * go into a calendar «Teacher Box» the portal creates; the portal never reads or changes other
 * calendars (only their busy times, if the teacher allows it). Network calls run outside
 * transactions; every database write commits on its own.
 */
@Service
public class GoogleCalendarService {

    /** Path of the OAuth redirect; the teacher registers it in Google Cloud. */
    public static final String CALLBACK_PATH = "/api/public/schedule/google/callback";
    static final String CALENDAR_NAME = "Teacher Box";
    static final Duration AUTHORIZATION_TTL = Duration.ofMinutes(10);
    static final Duration SYNC_PAST = Duration.ofDays(7);
    static final int SYNC_BATCH = 100;
    private static final Duration TOKEN_MARGIN = Duration.ofMinutes(1);
    private static final Logger log = LoggerFactory.getLogger(GoogleCalendarService.class);

    /**
     * @param clientFromEnvironment the OAuth client comes from environment variables and cannot be changed here
     * @param callbackPath          path of the redirect URI to register in Google Cloud
     */
    public record GoogleStatusView(
            boolean clientConfigured,
            boolean clientFromEnvironment,
            @Nullable String clientId,
            GoogleStatus status,
            boolean busyEnabled,
            @Nullable String lastError,
            @Nullable Instant lastSyncAt,
            @Nullable Instant connectedAt,
            String callbackPath) {
    }

    /** How the OAuth redirect ended. */
    public enum AuthorizationResult {
        CONNECTED,
        /** The teacher declined on Google's consent page. */
        DENIED,
        /** Unknown, used or expired state: start again. */
        EXPIRED,
        FAILED
    }

    private record AccessToken(String value, Instant expiresAt) {
    }

    private final GoogleApi api;
    private final GoogleRepository repository;
    private final LessonRepository lessons;
    private final UserDirectory directory;
    private final ApplicationEventPublisher events;
    private final ScheduleProperties properties;
    private final ZoneId zone;
    private final Clock clock;
    private volatile @Nullable AccessToken accessToken;

    public GoogleCalendarService(GoogleApi api, GoogleRepository repository, LessonRepository lessons,
            UserDirectory directory, ApplicationEventPublisher events, ScheduleProperties properties,
            InstanceTimeZone timeZone, Clock clock) {
        this.api = api;
        this.repository = repository;
        this.lessons = lessons;
        this.directory = directory;
        this.events = events;
        this.properties = properties;
        this.zone = timeZone.zoneId();
        this.clock = clock;
    }

    public GoogleStatusView status() {
        GoogleConnection connection = connection();
        GoogleApi.Client client = client(connection);
        return new GoogleStatusView(client != null, properties.google().clientFromEnvironment(),
                client == null ? null : client.id(), connection.status(), connection.busyEnabled(),
                connection.lastError(), connection.lastSyncAt(), connection.connectedAt(), CALLBACK_PATH);
    }

    /** Stores the OAuth client entered in the settings. */
    public void saveClient(String clientId, String clientSecret) {
        if (properties.google().clientFromEnvironment()) {
            throw new BusinessRuleException("schedule.google-client-from-environment",
                    "The Google client is set by environment variables");
        }
        String id = clientId.strip();
        String secret = clientSecret.strip();
        if (id.isEmpty() || secret.isEmpty()) {
            throw new BusinessRuleException("schedule.google-client-missing", "Enter the client id and secret");
        }
        repository.save(connection().withClient(id, secret, clock.instant()));
    }

    /**
     * Starts the authorization: the returned address opens Google's consent page, which then
     * redirects to {@code origin + CALLBACK_PATH}.
     *
     * @param origin address the teacher uses to open the portal, e.g. {@code https://school.example.com}
     * @param busy   also ask for the busy times of the teacher's calendars
     */
    public String authorize(String origin, boolean busy) {
        GoogleApi.Client client = requireClient(connection());
        String redirectUri = origin(origin) + CALLBACK_PATH;
        String state = FeedTokens.generate();
        repository.addAuthorization(FeedTokens.hash(state), redirectUri, busy, clock.instant().plus(AUTHORIZATION_TTL));
        List<String> scopes = busy ? List.of(GoogleApi.CALENDAR_SCOPE, GoogleApi.FREEBUSY_SCOPE)
                : List.of(GoogleApi.CALENDAR_SCOPE);
        return api.authorizationUrl(client.id(), redirectUri, scopes, state);
    }

    /** Finishes the authorization with Google's answer to the redirect URI. */
    public AuthorizationResult complete(@Nullable String state, @Nullable String code, @Nullable String error) {
        if (state == null || !FeedTokens.isWellFormed(state)) {
            return AuthorizationResult.EXPIRED;
        }
        PendingAuthorization pending = repository.takeAuthorization(FeedTokens.hash(state), clock.instant())
                .orElse(null);
        if (pending == null) {
            return AuthorizationResult.EXPIRED;
        }
        if (error != null || code == null || code.isBlank()) {
            return AuthorizationResult.DENIED;
        }
        GoogleConnection connection = connection();
        try {
            GoogleApi.Client client = requireClient(connection);
            GoogleApi.Tokens tokens = api.exchangeCode(client, code, pending.redirectUri());
            if (tokens.refreshToken() == null) {
                throw new GoogleException("Google did not return a refresh token");
            }
            String calendarId = connection.calendarId() != null
                    && api.calendarExists(tokens.accessToken(), connection.calendarId())
                    ? connection.calendarId()
                    : api.createCalendar(tokens.accessToken(), CALENDAR_NAME, zone.getId());
            Instant now = clock.instant();
            repository.forgetAll();
            repository.save(connection.connected(tokens.refreshToken(), calendarId, pending.busy(), now));
            accessToken = new AccessToken(tokens.accessToken(), now.plusSeconds(tokens.expiresInSeconds()));
            log.info("Google Calendar connected");
            return AuthorizationResult.CONNECTED;
        } catch (GoogleException | BusinessRuleException e) {
            log.warn("Google Calendar authorization failed: {}", e.getMessage());
            repository.save(connection.failed(String.valueOf(e.getMessage()), clock.instant()));
            return AuthorizationResult.FAILED;
        }
    }

    /** Revokes the access; the calendar with the lessons stays in Google and the teacher may delete it. */
    public void disconnect() {
        GoogleConnection connection = connection();
        String token = connection.refreshToken();
        if (token != null) {
            try {
                api.revoke(token);
            } catch (GoogleException e) {
                log.warn("Could not revoke the Google token: {}", e.getMessage());
            }
        }
        accessToken = null;
        repository.forgetAll();
        repository.save(connection.disconnected(clock.instant()));
    }

    /**
     * Puts new and changed lessons into the calendar and removes cancelled and deleted ones.
     *
     * @return number of changed events
     */
    public int sync() {
        GoogleConnection connection = connection();
        if (!connection.isConnected() || connection.calendarId() == null) {
            return 0;
        }
        String calendarId = connection.calendarId();
        Instant now = clock.instant();
        int changed = 0;
        try {
            String token = token(connection);
            Map<UUID, Long> synced = repository.syncedVersions();
            List<Lesson> window = lessons.findStartingBetween(now.minus(SYNC_PAST),
                    now.plus(properties.horizon()).plus(Duration.ofDays(1)));
            List<Lesson> pending = new ArrayList<>();
            for (Lesson lesson : window) {
                Long version = synced.get(lesson.id());
                boolean cancelled = lesson.status() == LessonStatus.CANCELLED;
                if ((cancelled && version != null) || (!cancelled && (version == null || version != lesson.version()))) {
                    pending.add(lesson);
                }
            }
            Map<UUID, String> names = names(pending);
            for (Lesson lesson : pending.subList(0, Math.min(pending.size(), SYNC_BATCH))) {
                if (lesson.status() == LessonStatus.CANCELLED) {
                    api.deleteEvent(token, calendarId, eventId(lesson.id()));
                    repository.forget(lesson.id());
                } else {
                    api.putEvent(token, calendarId, eventId(lesson.id()), event(lesson, names.get(lesson.studentId())));
                    repository.markSynced(lesson.id(), lesson.version(), clock.instant());
                }
                changed++;
            }
            for (UUID orphan : repository.orphans()) {
                api.deleteEvent(token, calendarId, eventId(orphan));
                repository.forget(orphan);
                changed++;
            }
            repository.save(connection().synced(clock.instant()));
        } catch (GoogleAuthException e) {
            lost(e);
        } catch (GoogleException e) {
            log.warn("Google Calendar sync failed: {}", e.getMessage());
            repository.save(connection().failed(String.valueOf(e.getMessage()), clock.instant()));
        }
        return changed;
    }

    /**
     * The administrator's check: an access token is obtained and the portal's calendar is looked up.
     *
     * @return what was found, or {@code null} when Google Calendar is not connected
     * @throws GoogleException if Google does not answer or no longer accepts the access
     */
    public @Nullable String checkConnection() {
        GoogleConnection connection = connection();
        String calendarId = connection.calendarId();
        if (!connection.isConnected() || calendarId == null) {
            return null;
        }
        try {
            return api.calendarExists(token(connection), calendarId)
                    ? "Календарь портала доступен"
                    : "Календарь портала удалён в Google — синхронизация создаст его заново";
        } catch (GoogleAuthException e) {
            lost(e);
            throw e;
        }
    }

    /** Busy times of the teacher's own calendars, if the teacher allowed reading them. */
    public List<GoogleApi.Busy> busy(Instant from, Instant to) {
        GoogleConnection connection = connection();
        if (!connection.isConnected() || !connection.busyEnabled()) {
            return List.of();
        }
        try {
            return api.busy(token(connection), from, to);
        } catch (GoogleAuthException e) {
            lost(e);
            return List.of();
        }
    }

    /** Google event id of a lesson: the lesson id in base32hex characters (hex without dashes). */
    static String eventId(UUID lessonId) {
        return lessonId.toString().replace("-", "");
    }

    Map<String, Object> event(Lesson lesson, @Nullable String studentName) {
        String name = studentName == null ? "ученик" : studentName;
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("summary", "Урок: " + name + (lesson.topic() == null ? "" : " — " + lesson.topic()));
        List<String> description = new ArrayList<>();
        if (lesson.topic() != null) {
            description.add("Тема: " + lesson.topic());
        }
        if (lesson.meetingUrl() != null) {
            description.add("Ссылка на урок: " + lesson.meetingUrl());
            event.put("location", lesson.meetingUrl());
        }
        switch (lesson.status()) {
            case CONDUCTED -> {
                description.add("Проведено");
                event.put("colorId", "10");
            }
            case MISSED -> {
                description.add("Пропуск");
                event.put("colorId", "6");
            }
            default -> {
                // planned lessons keep the calendar's color
            }
        }
        if (!description.isEmpty()) {
            event.put("description", String.join("\n", description));
        }
        event.put("start", Map.of("dateTime", lesson.startsAt().toString(), "timeZone", zone.getId()));
        event.put("end", Map.of("dateTime", lesson.endsAt().toString(), "timeZone", zone.getId()));
        event.put("status", "confirmed");
        return event;
    }

    private String token(GoogleConnection connection) {
        AccessToken current = accessToken;
        Instant now = clock.instant();
        if (current != null && current.expiresAt().isAfter(now.plus(TOKEN_MARGIN))) {
            return current.value();
        }
        String refreshToken = connection.refreshToken();
        if (refreshToken == null) {
            throw new GoogleAuthException("The calendar is not connected");
        }
        GoogleApi.Tokens tokens = api.refresh(requireClient(connection), refreshToken);
        accessToken = new AccessToken(tokens.accessToken(), now.plusSeconds(tokens.expiresInSeconds()));
        return tokens.accessToken();
    }

    private void lost(GoogleAuthException e) {
        log.warn("Google Calendar access is lost: {}", e.getMessage());
        accessToken = null;
        Instant now = clock.instant();
        repository.save(connection().needsReconnect(String.valueOf(e.getMessage()), now));
        events.publishEvent(new GoogleCalendarDisconnected(String.valueOf(e.getMessage()), now));
    }

    private Map<UUID, String> names(List<Lesson> found) {
        return directory.findStudents(found.stream().map(Lesson::studentId).distinct().toList()).stream()
                .collect(Collectors.toMap(StudentSummary::id, StudentSummary::displayName));
    }

    private GoogleConnection connection() {
        return repository.connection().orElseGet(() -> GoogleConnection.none(clock.instant()));
    }

    /** The client from the environment, or the one entered in the settings. */
    private GoogleApi.@Nullable Client client(GoogleConnection connection) {
        ScheduleProperties.Google google = properties.google();
        if (google.clientFromEnvironment() && google.clientId() != null && google.clientSecret() != null) {
            return new GoogleApi.Client(google.clientId().strip(), google.clientSecret().strip());
        }
        return connection.clientId() == null || connection.clientSecret() == null ? null
                : new GoogleApi.Client(connection.clientId(), connection.clientSecret());
    }

    private GoogleApi.Client requireClient(GoogleConnection connection) {
        GoogleApi.Client client = client(connection);
        if (client == null) {
            throw new BusinessRuleException("schedule.google-client-missing", "Enter the client id and secret first");
        }
        return client;
    }

    /** The scheme and host (and port) of the portal address the teacher uses. */
    static String origin(String value) {
        try {
            URI uri = new URI(value.strip());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null
                    || uri.getRawUserInfo() != null) {
                throw new BusinessRuleException("schedule.google-origin-invalid", "Unexpected portal address");
            }
            return scheme + "://" + uri.getRawAuthority();
        } catch (URISyntaxException e) {
            throw new BusinessRuleException("schedule.google-origin-invalid", "Unexpected portal address");
        }
    }
}
