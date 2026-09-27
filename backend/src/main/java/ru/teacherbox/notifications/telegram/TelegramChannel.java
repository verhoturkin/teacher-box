package ru.teacherbox.notifications.telegram;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import ru.teacherbox.notifications.application.BotCommand;
import ru.teacherbox.notifications.application.ButtonPress;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.application.MessengerChannel;
import ru.teacherbox.notifications.application.MessengerHttp;
import ru.teacherbox.notifications.application.OutgoingButton;
import ru.teacherbox.notifications.application.OutgoingMessage;
import ru.teacherbox.notifications.domain.ChannelType;
import tools.jackson.databind.JsonNode;

/**
 * Telegram Bot API: {@code sendMessage} with an inline keyboard and {@code getUpdates} long polling of
 * messages and pressed buttons ({@code callback_query}). The account is connected by the deep link
 * {@code t.me/<bot>?start=<code>} or by sending the code to the bot.
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
    public void send(String externalId, OutgoingMessage message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("chat_id", externalId);
        body.put("text", message.text());
        body.put("link_preview_options", Map.of("is_disabled", true));
        if (!message.rows().isEmpty()) {
            body.put("reply_markup", Map.of("inline_keyboard", keyboard(message.rows())));
        }
        try {
            http.post()
                    .uri(methodPath("sendMessage"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
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
                "timeout", MessengerHttp.POLL_TIMEOUT_SECONDS, "allowed_updates", List.of("message", "callback_query")));
        List<IncomingMessage> messages = new ArrayList<>();
        for (JsonNode update : response.path("result")) {
            offset = Math.max(offset, update.path("update_id").asLong() + 1);
            if (update.has("callback_query")) {
                pressed(update.path("callback_query")).ifPresent(messages::add);
                continue;
            }
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

    /** A pressed button in a private chat with the bot. */
    private static Optional<IncomingMessage> pressed(JsonNode callback) {
        String data = callback.path("data").asString("");
        JsonNode message = callback.path("message");
        String chatType = message.path("chat").path("type").asString("private");
        if (data.isEmpty() || !"private".equals(chatType) || !callback.path("from").has("id")) {
            return Optional.empty();
        }
        String messageId = message.path("message_id").asString("");
        return Optional.of(new IncomingMessage(callback.path("from").path("id").asString(),
                displayName(callback.path("from")), "", new ButtonPress(data, callback.path("id").asString(),
                        messageId.isEmpty() ? null : messageId, null)));
    }

    /** Stops the button's spinner and removes the used buttons from the message. */
    @Override
    public void acknowledge(String externalId, ButtonPress press) {
        if (press.callbackId() != null) {
            call("answerCallbackQuery", Map.of("callback_query_id", press.callbackId()));
        }
        if (press.messageId() != null) {
            call("editMessageReplyMarkup", Map.of("chat_id", externalId, "message_id", press.messageId(),
                    "reply_markup", Map.of("inline_keyboard", List.of())));
        }
    }

    @Override
    public void publishCommands(List<BotCommand> commands) {
        call("setMyCommands", Map.of("commands", commands.stream()
                .map(command -> Map.of("command", command.command(), "description", command.description()))
                .toList()));
    }

    private static List<List<Map<String, String>>> keyboard(List<List<OutgoingButton>> rows) {
        return rows.stream()
                .map(row -> row.stream()
                        .map(button -> button.data() != null
                                ? Map.of("text", button.label(), "callback_data", button.data())
                                : Map.of("text", button.label(), "url", String.valueOf(button.url())))
                        .toList())
                .toList();
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
