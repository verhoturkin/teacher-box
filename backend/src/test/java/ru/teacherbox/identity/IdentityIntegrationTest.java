package ru.teacherbox.identity;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.context.TestPropertySource;

/**
 * Identity module bootstrapped in isolation (only the module and the shared kernel) with MockMvc.
 * All test classes using this annotation share one Spring context and database.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ApplicationModuleTest
@AutoConfigureMockMvc
@Import(IdentityTestSupport.class)
@TestPropertySource(properties = {
        "teacherbox.identity.teacher.login=teacher",
        "teacherbox.identity.teacher.password=" + IdentityTestSupport.TEACHER_PASSWORD,
        "teacherbox.identity.teacher.name=Анна Сергеевна",
        "teacherbox.identity.max-failed-logins=3"
})
public @interface IdentityIntegrationTest {
}
