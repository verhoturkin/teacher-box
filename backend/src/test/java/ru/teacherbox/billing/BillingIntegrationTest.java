package ru.teacherbox.billing;

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
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;

/**
 * Billing module bootstrapped alone; the identity facades are replaced by {@link FakeUserDirectory} and
 * {@link FakeStudentGroups}.
 * All test classes using this annotation share one context and database.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ApplicationModuleTest
@AutoConfigureMockMvc
@Import(BillingIntegrationTest.Beans.class)
@TestPropertySource(properties = {
        "teacherbox.billing.default-lesson-price=1500",
        "teacherbox.billing.default-lesson-duration=60"
})
public @interface BillingIntegrationTest {

    @TestConfiguration
    class Beans {

        @Bean
        FakeUserDirectory userDirectory() {
            return new FakeUserDirectory();
        }

        @Bean
        FakeStudentGroups studentGroups() {
            return new FakeStudentGroups();
        }

        @Bean
        MutableClock clock() {
            return MutableClock.startingNow();
        }
    }
}
