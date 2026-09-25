package ru.teacherbox.notifications.max;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.application.MessengerChannel;
import ru.teacherbox.notifications.application.MessengerHttp;
import ru.teacherbox.notifications.domain.ChannelType;
import tools.jackson.databind.JsonNode;

/**
 * Bot API of the MAX messenger: {@code POST /messages} and {@code GET /updates} long polling. The
 * account is connected by the deep link {@code max.ru/<bot>?start=<code>} (event {@code bot_started})
 * or by sending the code to the bot.
 */
public class MaxChannel implements MessengerChannel {

    private final RestClient http;
    private final String token;
    private volatile @Nullable Long marker;
    private volatile @Nullable String username;

    /** @param http client with the API base URL ({@code https://platform-api2.max.ru}) */
    public MaxChannel(RestClient http, String token) {
        this.http = http;
        this.token = token;
    }

    @Override
    public ChannelType type() {
        return ChannelType.MAX;
    }

    @Override
    public Optional<String> chatLink(String code) {
        return botUsername().map(name -> "https://max.ru/" + name + "?start=" + code);
    }

    @Override
    public void send(String externalId, String text) {
        try {
            http.post()
                    .uri("/messages?user_id={userId}", externalId)
                    .header(HttpHeaders.AUTHORIZATION, token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("text", text))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            boolean permanent = e.getStatusCode().is4xxClientError() && status != 429;
            throw new DeliveryException("MAX " + status + ": " + describe(e), permanent);
        } catch (RestClientException e) {
            throw new DeliveryException("MAX: " + e.getMessage(), false);
        }
    }

    @Override
    public List<IncomingMessage> poll() {
        Long current = marker;
        JsonNode response = get(current == null
                ? "/updates?timeout={timeout}&types=message_created,bot_started"
                : "/updates?timeout={timeout}&types=message_created,bot_started&marker=" + current,
                MessengerHttp.POLL_TIMEOUT_SECONDS);
        if (response.hasNonNull("marker")) {
            marker = response.path("marker").asLong();
        }
        List<IncomingMessage> messages = new ArrayList<>();
        for (JsonNode update : response.path("updates")) {
            switch (update.path("update_type").asString("")) {
                case "message_created" -> fromMessage(update.path("message")).ifPresent(messages::add);
                case "bot_started" -> fromStart(update).ifPresent(messages::add);
                default -> {
                    // not interesting
                }
            }
        }
        return messages;
    }

    private static Optional<IncomingMessage> fromMessage(JsonNode message) {
        JsonNode sender = message.path("sender");
        String text = message.path("body").path("text").asString("");
        if (!"dialog".equals(message.path("recipient").path("chat_type").asString("")) || text.isEmpty()
                || !sender.has("user_id") || sender.path("is_bot").asBoolean()) {
            return Optional.empty();
        }
        return Optional.of(new IncomingMessage(sender.path("user_id").asString(), displayName(sender), text));
    }

    /** The user pressed "Start", possibly via a link with a start parameter. */
    private static Optional<IncomingMessage> fromStart(JsonNode update) {
        JsonNode user = update.path("user");
        if (!user.has("user_id")) {
            return Optional.empty();
        }
        String payload = update.path("payload").asString("");
        return Optional.of(new IncomingMessage(user.path("user_id").asString(), displayName(user),
                payload.isEmpty() ? "/start" : "/start " + payload));
    }

    private Optional<String> botUsername() {
        if (username == null) {
            try {
                String name = get("/me").path("username").asString("");
                username = name.isEmpty() ? null : name;
            } catch (IllegalStateException e) {
                return Optional.empty();
            }
        }
        return Optional.ofNullable(username);
    }

    private JsonNode get(String uri, Object... variables) {
        try {
            JsonNode response = http.get()
                    .uri(uri, variables)
                    .header(HttpHeaders.AUTHORIZATION, token)
                    .retrieve()
                    .body(JsonNode.class);
            if (response == null) {
                throw new IllegalStateException("MAX " + uri + ": empty response");
            }
            return response;
        } catch (RestClientResponseException e) {
            throw new IllegalStateException("MAX " + e.getStatusCode().value() + ": " + describe(e));
        } catch (RestClientException e) {
            throw new IllegalStateException("MAX: " + e.getMessage());
        }
    }

    private static String describe(RestClientResponseException e) {
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            if (body != null && body.has("message")) {
                return body.path("message").asString();
            }
        } catch (RuntimeException ignored) {
            // not a Bot API error body
        }
        return e.getStatusText();
    }

    private static @Nullable String displayName(JsonNode user) {
        String username = user.path("username").asString("");
        if (!username.isEmpty()) {
            return "@" + username;
        }
        String name = user.path("name").asString("");
        if (name.isEmpty()) {
            name = (user.path("first_name").asString("") + " " + user.path("last_name").asString("")).strip();
        }
        return name.isEmpty() ? null : name;
    }
}
