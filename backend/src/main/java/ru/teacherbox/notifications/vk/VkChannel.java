package ru.teacherbox.notifications.vk;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import org.jspecify.annotations.Nullable;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.application.MessengerChannel;
import ru.teacherbox.notifications.application.MessengerHttp;
import ru.teacherbox.notifications.domain.ChannelType;
import tools.jackson.databind.JsonNode;

/**
 * Messages of a VK community: {@code messages.send} and the Bots Long Poll API. The community must
 * allow messages and have Long Poll with the {@code message_new} event enabled. VK has no start
 * parameters, so the user writes the code to the community.
 */
public class VkChannel implements MessengerChannel {

    static final String VERSION = "5.199";
    /** Errors after which retrying is pointless: access denied, user blocked messages, privacy settings. */
    private static final Set<Integer> PERMANENT_ERRORS = Set.of(5, 7, 15, 900, 901, 902);

    private final RestClient http;
    private final String token;
    private final long groupId;
    private @Nullable String server;
    private @Nullable String key;
    private @Nullable String ts;

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
    public void send(String externalId, String text) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("user_id", externalId);
        form.add("random_id", Integer.toString(ThreadLocalRandom.current().nextInt(1, Integer.MAX_VALUE)));
        form.add("message", text);
        JsonNode response;
        try {
            response = method("messages.send", form);
        } catch (RestClientException e) {
            throw new DeliveryException("VK: " + MessengerHttp.redact(e.getMessage(), token), false);
        }
        JsonNode error = response.path("error");
        if (!error.isMissingNode()) {
            int code = error.path("error_code").asInt();
            throw new DeliveryException("VK " + code + ": " + error.path("error_msg").asString(""),
                    PERMANENT_ERRORS.contains(code));
        }
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
            messages.add(new IncomingMessage(Long.toString(from), "vk.com/id" + from, text));
        }
        return messages;
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
