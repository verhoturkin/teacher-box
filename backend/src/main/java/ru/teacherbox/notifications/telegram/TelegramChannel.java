package ru.teacherbox.notifications.telegram;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
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
 * Telegram Bot API: {@code sendMessage} and {@code getUpdates} long polling. The account is
 * connected by the deep link {@code t.me/<bot>?start=<code>} or by sending the code to the bot.
 */
public class TelegramChannel implements MessengerChannel {

    private final RestClient http;
    private final String token;
    private volatile long offset;
    private volatile @Nullable String username;

    /** @param http client with the Bot API base URL ({@code https://api.telegram.org}) */
    public TelegramChannel(RestClient http, String token) {
        this.http = http;
        this.token = token;
    }

    @Override
    public ChannelType type() {
        return ChannelType.TELEGRAM;
    }

    @Override
    public Optional<String> chatLink(String code) {
        return botUsername().map(name -> "https://t.me/" + name + "?start=" + code);
    }

    @Override
    public void send(String externalId, String text) {
        try {
            http.post()
                    .uri(methodPath("sendMessage"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("chat_id", externalId, "text", text,
                            "link_preview_options", Map.of("is_disabled", true)))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            boolean permanent = e.getStatusCode().is4xxClientError() && status != 429;
            throw new DeliveryException("Telegram " + status + ": " + describe(e), permanent);
        } catch (RestClientException e) {
            throw new DeliveryException("Telegram: " + MessengerHttp.redact(e.getMessage(), token), false);
        }
    }

    @Override
    public List<IncomingMessage> poll() {
        JsonNode response = call("getUpdates", Map.of("offset", offset,
                "timeout", MessengerHttp.POLL_TIMEOUT_SECONDS, "allowed_updates", List.of("message")));
        List<IncomingMessage> messages = new ArrayList<>();
        for (JsonNode update : response.path("result")) {
            offset = Math.max(offset, update.path("update_id").asLong() + 1);
            JsonNode message = update.path("message");
            String text = message.path("text").asString("");
            if (!"private".equals(message.path("chat").path("type").asString("")) || text.isEmpty()) {
                continue;
            }
            messages.add(new IncomingMessage(message.path("chat").path("id").asString(),
                    displayName(message.path("from")), text));
        }
        return messages;
    }

    @Override
    public String botName() {
        String name = call("getMe", Map.of()).path("result").path("username").asString("");
        if (name.isEmpty()) {
            throw new IllegalStateException("Telegram getMe returned no bot name");
        }
        username = name;
        return "@" + name;
    }

    private Optional<String> botUsername() {
        if (username == null) {
            try {
                String name = call("getMe", Map.of()).path("result").path("username").asString("");
                username = name.isEmpty() ? null : name;
            } catch (IllegalStateException e) {
                return Optional.empty();
            }
        }
        return Optional.ofNullable(username);
    }

    private JsonNode call(String method, Map<String, ?> body) {
        try {
            JsonNode response = http.post()
                    .uri(methodPath(method))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
            if (response == null || !response.path("ok").asBoolean()) {
                throw new IllegalStateException("Telegram " + method + " failed");
            }
            return response;
        } catch (RestClientResponseException e) {
            throw new IllegalStateException("Telegram " + method + " " + e.getStatusCode().value() + ": "
                    + describe(e));
        } catch (RestClientException e) {
            throw new IllegalStateException("Telegram " + method + ": " + MessengerHttp.redact(e.getMessage(), token));
        }
    }

    /** The token is part of the path; it is inserted literally because encoding ':' confuses some proxies. */
    private String methodPath(String method) {
        return "/bot" + token + "/" + method;
    }

    private String describe(RestClientResponseException e) {
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            if (body != null && body.has("description")) {
                return body.path("description").asString();
            }
        } catch (RuntimeException ignored) {
            // not a Bot API error body
        }
        return MessengerHttp.redact(e.getStatusText(), token);
    }

    private static @Nullable String displayName(JsonNode from) {
        String username = from.path("username").asString("");
        if (!username.isEmpty()) {
            return "@" + username;
        }
        String name = (from.path("first_name").asString("") + " " + from.path("last_name").asString("")).strip();
        return name.isEmpty() ? null : name;
    }
}
