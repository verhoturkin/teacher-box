package ru.teacherbox.platform.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

class SpaResourceResolverTest {

    private final Resource location = new ClassPathResource("spa-test/");
    private final SpaResourceResolver resolver = new SpaResourceResolver();

    @Test
    void returnsExistingFiles() throws IOException {
        assertThat(filename(resolver.getResource("main-ABC123.js", location))).isEqualTo("main-ABC123.js");
    }

    @Test
    void fallsBackToIndexForClientRoutes() throws IOException {
        assertThat(filename(resolver.getResource("", location))).isEqualTo("index.html");
        assertThat(filename(resolver.getResource("teacher/students/42", location))).isEqualTo("index.html");
    }

    @Test
    void doesNotFallBackForFilesApiAndActuator() throws IOException {
        assertThat(resolver.getResource("missing.js", location)).isNull();
        assertThat(resolver.getResource("api/unknown", location)).isNull();
        assertThat(resolver.getResource("api", location)).isNull();
        assertThat(resolver.getResource("actuator/env", location)).isNull();
    }

    @Test
    void returnsNothingWithoutIndex() throws IOException {
        assertThat(resolver.getResource("teacher", new ClassPathResource("db/"))).isNull();
    }

    @Test
    void classifiesClientRoutes() {
        assertThat(SpaResourceResolver.isClientRoute("cabinet/homework")).isTrue();
        assertThat(SpaResourceResolver.isClientRoute("assets/logo.svg")).isFalse();
        assertThat(SpaResourceResolver.isClientRoute("actuator")).isFalse();
    }

    private static String filename(Resource resource) {
        assertThat(resource).isNotNull();
        return String.valueOf(resource.getFilename());
    }
}
