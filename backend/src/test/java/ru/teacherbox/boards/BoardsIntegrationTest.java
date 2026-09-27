package ru.teacherbox.boards;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.modulith.test.ApplicationModuleTest;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;

/** Boards module bootstrapped alone; identity is replaced by fakes. One context and database for all. */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ApplicationModuleTest
@AutoConfigureMockMvc
@Import(BoardsIntegrationTest.Beans.class)
public @interface BoardsIntegrationTest {

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
