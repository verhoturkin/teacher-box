package ru.teacherbox.platform.web;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;

/** HTTP infrastructure: error responses. */
@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class PlatformWebAutoConfiguration {

    @Bean
    ProblemDetailsAdvice problemDetailsAdvice() {
        return new ProblemDetailsAdvice();
    }
}
