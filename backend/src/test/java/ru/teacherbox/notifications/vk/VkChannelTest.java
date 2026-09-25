package ru.teacherbox.notifications.vk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.application.NotificationsProperties;
import ru.teacherbox.notifications.domain.ChannelType;

class VkChannelTest {

    private static final String SEND = "https://api.vk.com/method/messages.send";
    private static final String LONG_POLL_SERVER = "https://api.vk.com/method/groups.getLongPollServer";

    private final RestClient.Builder builder = RestClient.builder().baseUrl("https://api.vk.com");
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final VkChannel channel = new VkChannel(builder.build(), "vk-token", 123);

    @Test
    void sendsCommunityMessageWithTokenInBody() {
        server.expect(requestTo(SEND))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(content().string(containsString("user_id=42")))
                .andExpect(content().string(containsString("random_id=")))
                .andExpect(content().string(containsString("access_token=vk-token")))
                .andExpect(content().string(containsString("v=5.199")))
                .andRespond(withSuccess("{\"response\": 17}", MediaType.APPLICATION_JSON));

        channel.send("42", "Привет");

        server.verify();
        assertThat(channel.type()).isEqualTo(ChannelType.VK);
        assertThat(channel.chatLink("ABCD2345")).contains("https://vk.me/club123");
    }

    @Test
    void classifiesApiErrors() {
        server.expect(requestTo(SEND)).andRespond(withSuccess("""
                {"error": {"error_code": 901, "error_msg": "Can't send messages for users without permission"}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(SEND)).andRespond(withSuccess("""
                {"error": {"error_code": 6, "error_msg": "Too many requests per second"}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(SEND)).andRespond(request -> {
            throw new IOException("Connection refused");
        });

        assertThatThrownBy(() -> channel.send("42", "1"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> {
                    assertThat(e.isPermanent()).isTrue();
                    assertThat(e.getMessage()).isEqualTo("VK 901: Can't send messages for users without permission");
                });
        assertThatThrownBy(() -> channel.send("42", "2"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> assertThat(e.isPermanent()).isFalse());
        assertThatThrownBy(() -> channel.send("42", "3"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> {
                    assertThat(e.isPermanent()).isFalse();
                    assertThat(e.getMessage()).contains("Connection refused");
                });
    }

    @Test
    void receivesPrivateMessagesThroughBotsLongPoll() {
        server.expect(requestTo(LONG_POLL_SERVER))
                .andExpect(content().string(containsString("group_id=123")))
                .andRespond(withSuccess("""
                        {"response": {"key": "KEY1", "server": "https://lp.vk.com/wh123", "ts": "10"}}
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://lp.vk.com/wh123?act=a_check&key=KEY1&ts=10&wait=25"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {"ts": "11", "updates": [
                          {"type": "message_new", "object": {"message": {"from_id": 5, "peer_id": 5, "text": "ABCD2345"}}},
                          {"type": "message_new", "object": {"message": {"from_id": 5, "peer_id": 2000000001, "text": "беседа"}}},
                          {"type": "message_new", "object": {"message": {"from_id": -1, "peer_id": -1, "text": "сообщество"}}},
                          {"type": "message_new", "object": {"message": {"from_id": 6, "peer_id": 6, "text": ""}}},
                          {"type": "message_reply", "object": {"from_id": 7, "peer_id": 7, "text": "ответ"}}
                        ]}
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://lp.vk.com/wh123?act=a_check&key=KEY1&ts=11&wait=25"))
                .andRespond(withSuccess("{\"failed\": 1, \"ts\": \"30\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://lp.vk.com/wh123?act=a_check&key=KEY1&ts=30&wait=25"))
                .andRespond(withSuccess("{\"failed\": 2}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(LONG_POLL_SERVER)).andRespond(withSuccess("""
                {"response": {"key": "KEY2", "server": "https://lp.vk.com/wh123", "ts": "99"}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://lp.vk.com/wh123?act=a_check&key=KEY2&ts=30&wait=25"))
                .andRespond(withSuccess("{\"failed\": 3}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(LONG_POLL_SERVER)).andRespond(withSuccess("""
                {"response": {"key": "KEY3", "server": "https://lp.vk.com/wh123", "ts": "100"}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://lp.vk.com/wh123?act=a_check&key=KEY3&ts=100&wait=25"))
                .andRespond(withSuccess("{\"ts\": \"100\", \"updates\": []}", MediaType.APPLICATION_JSON));

        assertThat(channel.poll()).containsExactly(new IncomingMessage("5", "vk.com/id5", "ABCD2345"));
        assertThat(channel.poll()).as("failed=1: new ts").isEmpty();
        assertThat(channel.poll()).as("failed=2: new key, same ts").isEmpty();
        assertThat(channel.poll()).as("failed=3: new key and ts").isEmpty();
        assertThat(channel.poll()).isEmpty();
        server.verify();
    }

    @Test
    void longPollServerErrors() {
        server.expect(requestTo(LONG_POLL_SERVER)).andRespond(withSuccess("""
                {"error": {"error_code": 100, "error_msg": "Long Poll is disabled"}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(LONG_POLL_SERVER)).andRespond(request -> {
            throw new IOException("DNS failure");
        });
        server.expect(requestTo(LONG_POLL_SERVER)).andRespond(withSuccess("""
                {"response": {"key": "KEY", "server": "https://lp.vk.com/wh123", "ts": "1"}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://lp.vk.com/wh123?act=a_check&key=KEY&ts=1&wait=25")).andRespond(request -> {
            throw new IOException("reset");
        });

        assertThatThrownBy(channel::poll).hasMessage("VK groups.getLongPollServer: Long Poll is disabled");
        assertThatThrownBy(channel::poll).hasMessageContaining("DNS failure").hasMessageNotContaining("vk-token");
        assertThatThrownBy(channel::poll).hasMessageContaining("VK long poll");
    }

    @Test
    void enabledOnlyWhenConfigured() {
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withUserConfiguration(PropertiesConfiguration.class, VkConfiguration.class)
                .withBean(RestClient.Builder.class, RestClient::builder);

        runner.run(context -> assertThat(context).doesNotHaveBean(VkChannel.class));
        runner.withPropertyValues("teacherbox.notifications.telegram.bot-token= ", "teacherbox.notifications.max.token= ")
                .run(context -> assertThat(context).doesNotHaveBean(VkChannel.class));
        runner.withPropertyValues("teacherbox.notifications.vk.token=vk-token")
                .run(context -> assertThat(context).doesNotHaveBean(VkChannel.class));
        runner.withPropertyValues("teacherbox.notifications.vk.token=", "teacherbox.notifications.vk.group-id=",
                        "teacherbox.notifications.public-url=")
                .run(context -> {
                    assertThat(context).hasNotFailed().doesNotHaveBean(VkChannel.class);
                    assertThat(context.getBean(NotificationsProperties.class).vk().groupId()).isNull();
                });
        runner.withPropertyValues("teacherbox.notifications.vk.token=vk-token", "teacherbox.notifications.vk.group-id=123")
                .run(context -> assertThat(context).hasSingleBean(VkChannel.class));
    }

    @EnableConfigurationProperties(NotificationsProperties.class)
    static class PropertiesConfiguration {
    }
}
