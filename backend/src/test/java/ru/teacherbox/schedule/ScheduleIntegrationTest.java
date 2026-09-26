package ru.teacherbox.schedule;

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
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;

/**
 * Schedule module bootstrapped alone; the identity facade is replaced by {@link FakeUserDirectory}.
 * All test classes using this annotation share one context, database and clock, so every test takes
 * its own time slots ({@link Slots}).
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ApplicationModuleTest
@AutoConfigureMockMvc
@Import(ScheduleIntegrationTest.Beans.class)
@TestPropertySource(properties = {
        "teacherbox.timezone=Europe/Moscow",
        "teacherbox.schedule.reminders=24h,1h",
        "teacherbox.schedule.late-cancellation=24h",
        "teacherbox.schedule.horizon=28d"
})
public @interface ScheduleIntegrationTest {

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
    }
}
