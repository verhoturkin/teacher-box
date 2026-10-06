package ru.teacherbox.platform.web;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;

/** HTTP infrastructure: request codes and error responses (the SPA is served by nginx, ADR-0031). */
@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class PlatformWebAutoConfiguration {

    @Bean
    ProblemDetailsAdvice problemDetailsAdvice() {
        return new ProblemDetailsAdvice();
    }

    /** Before everything else (security included), so that every log line of a request has its code. */
    @Bean
    FilterRegistrationBean<RequestIdFilter> requestIdFilter() {
        FilterRegistrationBean<RequestIdFilter> registration = new FilterRegistrationBean<>(new RequestIdFilter());
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }
}
