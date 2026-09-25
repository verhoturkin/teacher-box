package ru.teacherbox.notifications.max;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.application.NotificationsProperties;
import ru.teacherbox.notifications.domain.ChannelType;

class MaxChannelTest {

    private static final String API = "https://platform-api2.max.ru";
    private static final String UPDATES = API + "/updates?timeout=25&types=message_created,bot_started";

    private final RestClient.Builder builder = RestClient.builder().baseUrl(API);
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final MaxChannel channel = new MaxChannel(builder.build(), "max-token");

    @Test
    void sendsMessageToUserWithTokenInHeader() {
        server.expect(requestTo(API + "/messages?user_id=77"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "max-token"))
                .andExpect(jsonPath("$.text").value("Привет"))
                .andRespond(withSuccess("{\"message\": {}}", MediaType.APPLICATION_JSON));

        channel.send("77", "Привет");

        server.verify();
        assertThat(channel.type()).isEqualTo(ChannelType.MAX);
    }

    @Test
    void classifiesErrors() {
        server.expect(requestTo(API + "/messages?user_id=77"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"code\": \"chat.denied\", \"message\": \"User blocked the bot\"}"));
        server.expect(requestTo(API + "/messages?user_id=77")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        server.expect(requestTo(API + "/messages?user_id=77")).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        server.expect(requestTo(API + "/messages?user_id=77")).andRespond(request -> {
            throw new IOException("Connection reset");
        });

        assertThatThrownBy(() -> channel.send("77", "1"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> {
                    assertThat(e.isPermanent()).isTrue();
                    assertThat(e.getMessage()).isEqualTo("MAX 403: User blocked the bot");
                });
        assertThatThrownBy(() -> channel.send("77", "2"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> assertThat(e.isPermanent()).isFalse());
        assertThatThrownBy(() -> channel.send("77", "3"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> assertThat(e.isPermanent()).isFalse());
        assertThatThrownBy(() -> channel.send("77", "4"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> assertThat(e.isPermanent()).isFalse());
    }

    @Test
    void receivesDialogMessagesAndStartsWithPayload() {
        server.expect(requestTo(UPDATES))
                .andExpect(header("Authorization", "max-token"))
                .andRespond(withSuccess("""
                        {"marker": 5, "updates": [
                          {"update_type": "message_created", "message": {
                            "sender": {"user_id": 77, "name": "Мария", "is_bot": false},
                            "recipient": {"chat_id": 1, "chat_type": "dialog"}, "body": {"text": "ABCD-2345"}}},
                          {"update_type": "message_created", "message": {
                            "sender": {"user_id": 78, "username": "petr"},
                            "recipient": {"chat_id": 2, "chat_type": "chat"}, "body": {"text": "в чате"}}},
                          {"update_type": "message_created", "message": {
                            "sender": {"user_id": 79, "first_name": "Анна", "last_name": "К."},
                            "recipient": {"chat_type": "dialog"}, "body": {"text": "привет"}}},
                          {"update_type": "message_created", "message": {
                            "sender": {"user_id": 80}, "recipient": {"chat_type": "dialog"}, "body": {}}},
                          {"update_type": "bot_started", "chat_id": 3, "user": {"user_id": 81, "username": "olga"},
                            "payload": "EFGH6789"},
                          {"update_type": "bot_started", "chat_id": 4, "user": {"user_id": 82}},
                          {"update_type": "bot_started", "chat_id": 5},
                          {"update_type": "message_edited", "message": {}}
                        ]}
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(UPDATES + "&marker=5"))
                .andRespond(withSuccess("{\"marker\": null, \"updates\": []}", MediaType.APPLICATION_JSON));

        assertThat(channel.poll()).containsExactly(
                new IncomingMessage("77", "Мария", "ABCD-2345"),
                new IncomingMessage("79", "Анна К.", "привет"),
                new IncomingMessage("81", "@olga", "/start EFGH6789"),
                new IncomingMessage("82", null, "/start"));
        assertThat(channel.poll()).isEmpty();
        server.verify();
    }

    @Test
    void pollingErrors() {
        server.expect(requestTo(UPDATES)).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                .contentType(MediaType.APPLICATION_JSON).body("{\"code\": \"verify.token\", \"message\": \"Invalid token\"}"));
        server.expect(requestTo(UPDATES)).andRespond(request -> {
            throw new IOException("timeout");
        });

        assertThatThrownBy(channel::poll).hasMessage("MAX 401: Invalid token");
        assertThatThrownBy(channel::poll).hasMessageContaining("timeout");
    }

    @Test
    void deepLinkUsesBotUsername() {
        server.expect(requestTo(API + "/me")).andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        server.expect(requestTo(API + "/me"))
                .andRespond(withSuccess("{\"user_id\": 1, \"username\": \"id7700_bot\"}", MediaType.APPLICATION_JSON));

        assertThat(channel.chatLink("ABCD2345")).isEmpty();
        assertThat(channel.chatLink("ABCD2345")).contains("https://max.ru/id7700_bot?start=ABCD2345");
        assertThat(channel.chatLink("EFGH6789")).contains("https://max.ru/id7700_bot?start=EFGH6789");
        server.verify();
    }

    @Test
    void enabledOnlyWhenConfigured() {
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withUserConfiguration(PropertiesConfiguration.class, MaxConfiguration.class)
                .withBean(RestClient.Builder.class, RestClient::builder);

        runner.run(context -> assertThat(context).doesNotHaveBean(MaxChannel.class));
        runner.withPropertyValues("teacherbox.notifications.telegram.bot-token= ", "teacherbox.notifications.max.token= ")
                .run(context -> assertThat(context).doesNotHaveBean(MaxChannel.class));
        runner.withPropertyValues("teacherbox.notifications.max.token=max-token")
                .run(context -> assertThat(context).hasSingleBean(MaxChannel.class));
    }

    @EnableConfigurationProperties(NotificationsProperties.class)
    static class PropertiesConfiguration {
    }
}
