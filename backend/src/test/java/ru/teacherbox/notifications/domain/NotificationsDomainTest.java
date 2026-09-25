package ru.teacherbox.notifications.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;

class NotificationsDomainTest {

    private static final Instant NOW = Instant.parse("2026-09-25T10:00:00Z");

    @Test
    void inboxNotificationValidatesAndTrims() {
        InboxNotification notification = InboxNotification.create(UUID.randomUUID(), UUID.randomUUID(),
                NotificationKind.MESSAGE, "  Тема  ", "  Текст  ", "/cabinet", NOW);

        assertThat(notification.title()).isEqualTo("Тема");
        assertThat(notification.body()).isEqualTo("Текст");
        assertThat(notification.isRead()).isFalse();
        assertThatThrownBy(() -> create("x".repeat(301), null)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> create("", null)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> create("Тема", "x".repeat(4001))).isInstanceOf(BusinessRuleException.class);
        assertThat(create("Тема", null).body()).isNull();
    }

    @Test
    void messengerTextAddsAbsoluteLinkWhenPublicUrlIsKnown() {
        InboxNotification withLink = InboxNotification.create(UUID.randomUUID(), UUID.randomUUID(),
                NotificationKind.MESSAGE, "Тема", "Текст", "/cabinet/billing", NOW);
        InboxNotification withoutLink = create("Тема", null);

        assertThat(withLink.messengerText("https://school.example.com//"))
                .isEqualTo("Тема\nТекст\nhttps://school.example.com/cabinet/billing");
        assertThat(withLink.messengerText(null)).isEqualTo("Тема\nТекст");
        assertThat(withLink.messengerText(" ")).isEqualTo("Тема\nТекст");
        assertThat(withoutLink.messengerText("https://school.example.com")).isEqualTo("Тема");
    }

    @Test
    void linkCodesAreShortReadableAndFoundInMessages() {
        String code = LinkCodes.generate();

        assertThat(code).hasSize(8).matches("[A-HJ-NP-Z2-9]{8}");
        assertThat(LinkCodes.display("ABCD2345")).isEqualTo("ABCD-2345");
        assertThat(LinkCodes.find("/start ABCD2345")).contains("ABCD2345");
        assertThat(LinkCodes.find("мой код abcd-2345, спасибо")).contains("ABCD2345");
        assertThat(LinkCodes.find("ABCD 2345")).contains("ABCD2345");
        assertThat(LinkCodes.find("helloworld")).isEmpty();
        assertThat(LinkCodes.find("ABCD23456")).isEmpty();
        assertThat(LinkCodes.find("привет")).isEmpty();
        assertThat(LinkCodes.hash("abcd2345")).isEqualTo(LinkCodes.hash("ABCD2345")).hasSize(64);
    }

    @Test
    void linkCodeIsUsableOnceBeforeExpiry() {
        LinkCode code = new LinkCode("hash", UUID.randomUUID(), ChannelType.TELEGRAM, NOW, NOW.plusSeconds(60), null);
        LinkCode used = new LinkCode("hash", UUID.randomUUID(), ChannelType.TELEGRAM, NOW, NOW.plusSeconds(60), NOW);

        assertThat(code.isUsable(NOW)).isTrue();
        assertThat(code.isUsable(NOW.plusSeconds(60))).isFalse();
        assertThat(used.isUsable(NOW)).isFalse();
    }

    @Test
    void channelLinkCanBePaused() {
        ChannelLink link = new ChannelLink(UUID.randomUUID(), UUID.randomUUID(), ChannelType.MAX, "1", "@me", true,
                NOW);

        assertThat(link.withEnabled(false).enabled()).isFalse();
        assertThat(link.withEnabled(false).externalId()).isEqualTo("1");
    }

    @Test
    void deliveryBacksOffExponentiallyUpToAnHour() {
        assertThat(Delivery.backoff(1)).isEqualTo(Duration.ofSeconds(30));
        assertThat(Delivery.backoff(2)).isEqualTo(Duration.ofMinutes(1));
        assertThat(Delivery.backoff(5)).isEqualTo(Duration.ofMinutes(8));
        assertThat(Delivery.backoff(8)).isEqualTo(Duration.ofHours(1));
        assertThat(Delivery.backoff(40)).isEqualTo(Duration.ofHours(1));
    }

    @Test
    void deliveryLifecycle() {
        Delivery delivery = Delivery.schedule(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                ChannelType.TELEGRAM, "1", "text", NOW);
        assertThat(delivery.status()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(delivery.nextAttemptAt()).isEqualTo(NOW);
        assertThat(delivery.createdAt()).isEqualTo(NOW);

        delivery.markFailed("e".repeat(2000), 2, NOW);
        assertThat(delivery.lastError()).hasSize(1000);
        assertThat(delivery.status()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(delivery.nextAttemptAt()).isEqualTo(NOW.plusSeconds(30));

        delivery.markSent(NOW.plusSeconds(31));
        assertThat(delivery.status()).isEqualTo(DeliveryStatus.SENT);
        assertThat(delivery.attempts()).isEqualTo(2);
        assertThat(delivery.lastError()).isNull();
        assertThat(delivery.sentAt()).isEqualTo(NOW.plusSeconds(31));

        Delivery abandoned = Delivery.schedule(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                ChannelType.VK, "1", "text", NOW);
        abandoned.abandon("gone");
        assertThat(abandoned.status()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(abandoned.attempts()).isZero();
        assertThat(abandoned.lastError()).isEqualTo("gone");
    }

    private static InboxNotification create(String title, String body) {
        return InboxNotification.create(UUID.randomUUID(), UUID.randomUUID(), NotificationKind.MESSAGE, title, body,
                null, NOW);
    }
}
