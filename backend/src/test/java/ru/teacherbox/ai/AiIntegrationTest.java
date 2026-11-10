package ru.teacherbox.ai;

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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import ru.teacherbox.ai.persistence.ProviderRepository;
import ru.teacherbox.homework.api.AssignmentFiles;
import ru.teacherbox.homework.api.QuizDrafts;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.textbooks.api.Textbooks;

/**
 * AI module bootstrapped alone with a scripted {@link FakeLlmClient} instead of a real provider: the fake provider
 * ({@link FakeProvider}) is the only one, its model the default, the limit 100 000 tokens; the facades it reads sources
 * through are mocks.
 * All test classes using this annotation share one context and database.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ApplicationModuleTest
@AutoConfigureMockMvc
@Import(AiIntegrationTest.Beans.class)
@MockitoBean(types = {Textbooks.class, AssignmentFiles.class, QuizDrafts.class})
@TestPropertySource(properties = {
        "teacherbox.timezone=Europe/Moscow"
})
public @interface AiIntegrationTest {

    @TestConfiguration
    class Beans {

        @Bean
        FakeLlmClient llmClient() {
            return new FakeLlmClient();
        }

        @Bean
        FakeProvider fakeProvider(FakeLlmClient llm, ProviderRepository providers) {
            return new FakeProvider(llm, providers);
        }

        @Bean
        MutableClock clock() {
            return MutableClock.startingNow();
        }
    }
}
