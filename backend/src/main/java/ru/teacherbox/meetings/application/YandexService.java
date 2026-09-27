package ru.teacherbox.meetings.application;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.meetings.domain.YandexConnection;
import ru.teacherbox.meetings.domain.YandexStatus;
import ru.teacherbox.meetings.persistence.YandexRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.security.SecretTokens;

/**
 * The teacher's Yandex account for the Telemost API (ADR-0012): OAuth 2.0 authorization code with
 * the teacher's application in Yandex ID, or a ready token from the environment.
 */
@Service
public class YandexService {

    /** Path of the OAuth redirect; the teacher registers it in the application in Yandex ID. */
    public static final String CALLBACK_PATH = "/api/public/meetings/yandex/callback";
    static final Duration AUTHORIZATION_TTL = Duration.ofMinutes(10);
    private static final Duration TOKEN_MARGIN = Duration.ofMinutes(5);
    private static final Logger log = LoggerFactory.getLogger(YandexService.class);

    /**
     * @param clientFromEnvironment the OAuth client comes from environment variables
     * @param tokenFromEnvironment  a ready token comes from {@code TEACHERBOX_MEETINGS_TELEMOST_TOKEN}
     * @param callbackPath          path of the redirect address to register in Yandex ID
     */
    public record YandexStatusView(
            boolean clientConfigured,
            boolean clientFromEnvironment,
            boolean tokenFromEnvironment,
            @Nullable String clientId,
            YandexStatus status,
            boolean waitingRoom,
            @Nullable String lastError,
            @Nullable Instant connectedAt,
            String callbackPath) {
    }

    /** How the OAuth redirect ended. */
    public enum AuthorizationResult {
        CONNECTED,
        /** The teacher declined on Yandex's consent page. */
        DENIED,
        /** Unknown, used or expired state: start again. */
        EXPIRED,
        FAILED
    }

    private final TelemostApi api;
    private final YandexRepository repository;
    private final MeetingsProperties properties;
    private final Clock clock;

    public YandexService(TelemostApi api, YandexRepository repository, MeetingsProperties properties, Clock clock) {
        this.api = api;
        this.repository = repository;
        this.properties = properties;
        this.clock = clock;
    }

    public YandexStatusView status() {
        YandexConnection connection = connection();
        TelemostApi.Client client = client(connection);
        boolean fromEnvironment = properties.telemost().tokenFromEnvironment();
        return new YandexStatusView(client != null, properties.yandex().clientFromEnvironment(), fromEnvironment,
                client == null ? null : client.id(), fromEnvironment ? YandexStatus.CONNECTED : connection.status(),
                connection.waitingRoom(), connection.lastError(), connection.connectedAt(), CALLBACK_PATH);
    }

    /** Whether meetings can be created through the API. */
    public boolean canCreateMeetings() {
        return properties.telemost().tokenFromEnvironment() || connection().isConnected();
    }

    /** Stores the OAuth client entered in the settings. */
    public void saveClient(String clientId, String clientSecret) {
        if (properties.yandex().clientFromEnvironment()) {
            throw new BusinessRuleException("meetings.client-from-environment",
                    "The Yandex client is set by environment variables");
        }
        String id = clientId.strip();
        String secret = clientSecret.strip();
        if (id.isEmpty() || secret.isEmpty()) {
            throw new BusinessRuleException("meetings.client-missing", "Enter the client id and secret");
        }
        repository.save(connection().withClient(id, secret, clock.instant()));
    }

    /** Students wait until the teacher lets them in (applies to rooms created from now on). */
    public void setWaitingRoom(boolean enabled) {
        repository.save(connection().withWaitingRoom(enabled, clock.instant()));
    }

    /** Waiting room level of new meetings. */
    public String waitingRoomLevel() {
        return connection().waitingRoom() ? "ADMINS" : "PUBLIC";
    }

    /**
     * Starts the authorization: the returned address opens Yandex's consent page, which then
     * redirects to {@code origin + CALLBACK_PATH}.
     *
     * @param origin address the teacher uses to open the portal, e.g. {@code https://school.example.com}
     */
    public String authorize(String origin) {
        TelemostApi.Client client = requireClient(connection());
        String redirectUri = origin(origin) + CALLBACK_PATH;
        String state = SecretTokens.generate();
        repository.addAuthorization(SecretTokens.hash(state), redirectUri, clock.instant().plus(AUTHORIZATION_TTL));
        return api.authorizationUrl(client.id(), redirectUri, state, deviceId(client));
    }

    /** Finishes the authorization with Yandex's answer to the redirect address. */
    public AuthorizationResult complete(@Nullable String state, @Nullable String code, @Nullable String error) {
        if (state == null || !SecretTokens.isWellFormed(state)
                || repository.takeAuthorization(SecretTokens.hash(state), clock.instant()).isEmpty()) {
            return AuthorizationResult.EXPIRED;
        }
        if (error != null || code == null || code.isBlank()) {
            return AuthorizationResult.DENIED;
        }
        YandexConnection connection = connection();
        try {
            TelemostApi.Tokens tokens = api.exchangeCode(requireClient(connection), code);
            Instant now = clock.instant();
            repository.save(connection.connected(tokens.accessToken(), tokens.refreshToken(),
                    now.plusSeconds(tokens.expiresInSeconds()), now));
            log.info("Yandex account connected for Telemost");
            return AuthorizationResult.CONNECTED;
        } catch (TelemostException | BusinessRuleException e) {
            log.warn("Yandex authorization failed: {}", e.getMessage());
            repository.save(connection.failed(String.valueOf(e.getMessage()), clock.instant()));
            return AuthorizationResult.FAILED;
        }
    }

    /** Revokes the token (it was issued for the portal as a device) and forgets it. */
    public void disconnect() {
        YandexConnection connection = connection();
        TelemostApi.Client client = client(connection);
        String token = connection.accessToken();
        if (client != null && token != null) {
            try {
                api.revoke(client, token);
            } catch (TelemostException e) {
                log.warn("Could not revoke the Yandex token: {}", e.getMessage());
            }
        }
        repository.save(connection.disconnected(clock.instant()));
    }

    /**
     * A token for the Telemost API: the one from the environment, or the connection's (refreshed
     * shortly before it expires).
     *
     * @throws BusinessRuleException if Yandex is not connected
     */
    public String accessToken() {
        String fromEnvironment = properties.telemost().token();
        if (fromEnvironment != null && !fromEnvironment.isBlank()) {
            return fromEnvironment.strip();
        }
        YandexConnection connection = connection();
        String token = connection.accessToken();
        if (!connection.isConnected() || token == null) {
            throw new BusinessRuleException("meetings.not-connected", "Connect a Yandex account first");
        }
        Instant now = clock.instant();
        Instant expiresAt = connection.accessExpiresAt();
        String refreshToken = connection.refreshToken();
        if (expiresAt == null || expiresAt.minus(TOKEN_MARGIN).isAfter(now) || refreshToken == null) {
            return token;
        }
        try {
            TelemostApi.Tokens tokens = api.refresh(requireClient(connection), refreshToken);
            repository.save(connection.refreshed(tokens.accessToken(), tokens.refreshToken(),
                    now.plusSeconds(tokens.expiresInSeconds()), now));
            return tokens.accessToken();
        } catch (TelemostAuthException e) {
            lost(e);
            throw e;
        }
    }

    /**
     * Yandex no longer accepts the connection: the teacher connects the account again. Stored in its
     * own transaction, so that the failed operation does not roll it back.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void lost(TelemostAuthException e) {
        if (properties.telemost().tokenFromEnvironment()) {
            return;
        }
        log.warn("Yandex access is lost: {}", e.getMessage());
        repository.save(connection().needsReconnect(String.valueOf(e.getMessage()), clock.instant()));
    }

    private YandexConnection connection() {
        return repository.connection().orElseGet(() -> YandexConnection.none(clock.instant()));
    }

    /** The client from the environment, or the one entered in the settings. */
    private TelemostApi.@Nullable Client client(YandexConnection connection) {
        MeetingsProperties.Yandex yandex = properties.yandex();
        if (yandex.clientFromEnvironment() && yandex.clientId() != null && yandex.clientSecret() != null) {
            return new TelemostApi.Client(yandex.clientId().strip(), yandex.clientSecret().strip());
        }
        return connection.clientId() == null || connection.clientSecret() == null ? null
                : new TelemostApi.Client(connection.clientId(), connection.clientSecret());
    }

    private TelemostApi.Client requireClient(YandexConnection connection) {
        TelemostApi.Client client = client(connection);
        if (client == null) {
            throw new BusinessRuleException("meetings.client-missing", "Enter the client id and secret first");
        }
        return client;
    }

    /** The portal is one «device» of the teacher's application: its token can be revoked. */
    static String deviceId(TelemostApi.Client client) {
        String id = client.id().replaceAll("[^A-Za-z0-9]", "");
        return "teacherbox-" + id.substring(0, Math.min(id.length(), 24));
    }

    /** The scheme and host (and port) of the portal address the teacher uses. */
    static String origin(String value) {
        try {
            URI uri = new URI(value.strip());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null
                    || uri.getRawUserInfo() != null) {
                throw new BusinessRuleException("meetings.origin-invalid", "Unexpected portal address");
            }
            return scheme + "://" + uri.getRawAuthority();
        } catch (URISyntaxException e) {
            throw new BusinessRuleException("meetings.origin-invalid", "Unexpected portal address");
        }
    }
}
