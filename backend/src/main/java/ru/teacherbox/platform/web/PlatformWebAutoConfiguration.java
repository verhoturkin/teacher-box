package ru.teacherbox.platform.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnResource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** HTTP infrastructure: request codes, error responses and, when bundled, the single page application. */
@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class PlatformWebAutoConfiguration {

    static final String STATIC_LOCATION = "${teacherbox.web.static-location:classpath:/static/}";

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

    /** Active only when the frontend is bundled into the backend (single-container variant). */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnResource(resources = STATIC_LOCATION + "index.html")
    static class SpaConfiguration {

        @Bean
        WebMvcConfigurer spaWebConfigurer(@Value(STATIC_LOCATION) String location) {
            return new SpaWebConfigurer(location);
        }
    }
}
