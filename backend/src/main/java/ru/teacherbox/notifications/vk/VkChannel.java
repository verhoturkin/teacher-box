package ru.teacherbox.notifications.vk;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import ru.teacherbox.notifications.application.ButtonPress;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.application.MessengerChannel;
import ru.teacherbox.notifications.application.MessengerHttp;
import ru.teacherbox.notifications.application.OutgoingButton;
import ru.teacherbox.notifications.application.OutgoingMessage;
import ru.teacherbox.notifications.domain.ChannelType;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Messages of a VK community: {@code messages.send} and the Bots Long Poll API. The community must
 * allow messages and have Long Poll with the {@code message_new} event enabled. VK has no start
 * parameters, so the user writes the code to the community. Buttons are inline text buttons: a press
 * arrives as a message with the button's {@code payload}; they need the community's bot features
 * («Возможности ботов»), without them messages go without buttons.
 */
public class VkChannel implements MessengerChannel {

    static final String VERSION = "5.199";
    /** The keyboard is invalid, or the community has no bot features. */
    static final Set<Integer> KEYBOARD_ERRORS = Set.of(911, 912);
    private static final Logger log = LoggerFactory.getLogger(VkChannel.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    /** Errors after which retrying is pointless: access denied, user blocked messages, privacy settings. */
    private static final Set<Integer> PERMANENT_ERRORS = Set.of(5, 7, 15, 900, 901, 902);

    private final RestClient http;
    private final String token;
    private final long groupId;
    private @Nullable String server;
    private @Nullable String key;
    private @Nullable String ts;
    private volatile boolean keyboards = true;

    /** @param http client with the API base URL ({@code https://api.vk.com}) */
    public VkChannel(RestClient http, String token, long groupId) {
        this.http = http;
        this.token = token;
        this.groupId = groupId;
    }

    @Override
    public ChannelType type() {
        return ChannelType.VK;
    }

    @Override
    public Optional<String> chatLink(String code) {
        return Optional.of("https://vk.me/club" + groupId);
    }

    @Override
    public void send(String externalId, OutgoingMessage message) {
        boolean withButtons = keyboards && !message.rows().isEmpty();
        JsonNode error = messagesSend(externalId, message, withButtons);
        if (withButtons && !error.isMissingNode() && KEYBOARD_ERRORS.contains(error.path("error_code").asInt())) {
            log.warn("VK refused the buttons ({}); messages go without buttons. Turn on the community's bot features",
                    error.path("error_msg").asString(""));
            keyboards = false;
            error = messagesSend(externalId, message, false);
        }
        if (!error.isMissingNode()) {
            int code = error.path("error_code").asInt();
            throw new DeliveryException("VK " + code + ": " + error.path("error_msg").asString(""),
                    PERMANENT_ERRORS.contains(code));
        }
    }

    /** @return the error of the call, a missing node if none */
    private JsonNode messagesSend(String externalId, OutgoingMessage message, boolean withButtons) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("user_id", externalId);
        form.add("random_id", Integer.toString(ThreadLocalRandom.current().nextInt(1, Integer.MAX_VALUE)));
        form.add("message", message.text());
        if (withButtons) {
            form.add("keyboard", keyboard(message.rows()));
        }
        JsonNode response;
        try {
            response = method("messages.send", form);
        } catch (RestClientException e) {
            throw new DeliveryException("VK: " + MessengerHttp.redact(e.getMessage(), token), false);
        }
        return response.path("error");
    }

    /** An inline keyboard: text buttons carry the data in the payload, links open in the browser. */
    static String keyboard(List<List<OutgoingButton>> rows) {
        List<List<Map<String, Object>>> buttons = rows.stream()
                .map(row -> row.stream()
                        .map(button -> button.data() != null
                                ? Map.<String, Object>of("action", Map.of("type", "text", "label", button.label(),
                                        "payload", JSON.writeValueAsString(Map.of("b", button.data()))),
                                        "color", "secondary")
                                : Map.<String, Object>of("action", Map.of("type", "open_link",
                                        "link", String.valueOf(button.url()), "label", button.label())))
                        .toList())
                .toList();
        return JSON.writeValueAsString(Map.of("inline", true, "buttons", buttons));
    }

    @Override
    public synchronized List<IncomingMessage> poll() {
        if (server == null || key == null || ts == null) {
            connect(true);
        }
        JsonNode response;
        try {
            response = http.get()
                    .uri(server + "?act=a_check&key={key}&ts={ts}&wait={wait}", key, ts,
                            MessengerHttp.POLL_TIMEOUT_SECONDS)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            throw new IllegalStateException("VK long poll: " + e.getMessage());
        }
        if (response == null) {
            return List.of();
        }
        if (response.has("failed")) {
            switch (response.path("failed").asInt()) {
                case 1 -> ts = response.path("ts").asString();
                case 2 -> connect(false);
                default -> connect(true);
            }
            return List.of();
        }
        ts = response.path("ts").asString();
        List<IncomingMessage> messages = new ArrayList<>();
        for (JsonNode update : response.path("updates")) {
            JsonNode message = update.path("object").path("message");
            long from = message.path("from_id").asLong();
            String text = message.path("text").asString("");
            if (!"message_new".equals(update.path("type").asString("")) || from <= 0
                    || message.path("peer_id").asLong() != from || text.isEmpty()) {
                continue;
            }
            messages.add(new IncomingMessage(Long.toString(from), "vk.com/id" + from, text,
                    press(message.path("payload").asString(""))));
        }
        return messages;
    }

    /** The data of our button from the payload of the message; other payloads (e.g. «Начать») are ignored. */
    private static @Nullable ButtonPress press(String payload) {
        if (payload.isEmpty()) {
            return null;
        }
        try {
            String data = JSON.readTree(payload).path("b").asString("");
            return data.isEmpty() ? null : new ButtonPress(data, null, null, null);
        } catch (JacksonException e) {
            return null;
        }
    }

    /** Name of the community; also checks the token. */
    @Override
    public String botName() {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("group_id", Long.toString(groupId));
        JsonNode response;
        try {
            response = method("groups.getById", form);
        } catch (RestClientException e) {
            throw new IllegalStateException("VK groups.getById: " + MessengerHttp.redact(e.getMessage(), token));
        }
        JsonNode error = response.path("error");
        if (!error.isMissingNode()) {
            throw new IllegalStateException("VK " + error.path("error_code").asInt() + ": "
                    + error.path("error_msg").asString(""));
        }
        JsonNode result = response.path("response");
        JsonNode groups = result.has("groups") ? result.path("groups") : result;
        String name = groups.path(0).path("name").asString("");
        return name.isEmpty() ? "club" + groupId : name;
    }

    /** Gets a long poll server and key; keeps the event position unless {@code resetPosition}. */
    private void connect(boolean resetPosition) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("group_id", Long.toString(groupId));
        JsonNode response;
        try {
            response = method("groups.getLongPollServer", form);
        } catch (RestClientException e) {
            throw new IllegalStateException("VK groups.getLongPollServer: " + MessengerHttp.redact(e.getMessage(), token));
        }
        JsonNode result = response.path("response");
        if (result.isMissingNode()) {
            throw new IllegalStateException("VK groups.getLongPollServer: "
                    + response.path("error").path("error_msg").asString("unexpected response"));
        }
        server = result.path("server").asString();
        key = result.path("key").asString();
        if (resetPosition || ts == null) {
            ts = result.path("ts").asString();
        }
    }

    /** Calls an API method; the token goes in the form body so that it never appears in URLs. */
    private JsonNode method(String name, MultiValueMap<String, String> form) {
        form.add("access_token", token);
        form.add("v", VERSION);
        JsonNode response = http.post()
                .uri("/method/{name}", name)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(JsonNode.class);
        if (response == null) {
            throw new IllegalStateException("VK " + name + ": empty response");
        }
        return response;
    }
}
