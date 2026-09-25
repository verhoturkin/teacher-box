package ru.teacherbox.notifications;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.context.TestPropertySource;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;

/**
 * Notifications module bootstrapped alone: users come from {@link FakeUserDirectory}, the only
 * messenger is a {@link FakeMessengerChannel} posing as Telegram. All test classes using this
 * annotation share one context and database.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ApplicationModuleTest
@AutoConfigureMockMvc
@Import(NotificationsIntegrationTest.Beans.class)
@TestPropertySource(properties = {
        "teacherbox.notifications.public-url=https://school.example.com/",
        "teacherbox.notifications.max-attempts=3",
        "teacherbox.timezone=Europe/Moscow"
})
public @interface NotificationsIntegrationTest {

    @TestConfiguration
    class Beans {

        @Bean
        FakeUserDirectory userDirectory() {
            return new FakeUserDirectory();
        }

        @Bean
        MutableClock clock() {
            return MutableClock.startingNow();
        }

        @Bean
        FakeMessengerChannel telegram() {
            return new FakeMessengerChannel(ChannelType.TELEGRAM);
        }
    }
}
