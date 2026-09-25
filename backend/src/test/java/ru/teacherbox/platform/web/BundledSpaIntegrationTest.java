package ru.teacherbox.platform.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

/** Single-container variant: the backend serves the bundled Angular application. */
@SpringBootTest(properties = "teacherbox.web.static-location=classpath:/spa-test/")
@AutoConfigureMockMvc
class BundledSpaIntegrationTest {

    @Autowired
    MockMvcTester mvc;

    @Test
    void clientRoutesServeIndexWithoutCaching() {
        assertThat(mvc.get().uri("/teacher/students"))
                .hasStatusOk()
                .hasHeader(HttpHeaders.CACHE_CONTROL, "no-cache")
                .bodyText().contains("spa-index");
    }

    @Test
    void rootIsForwardedToIndex() {
        // MockMvc records forwards instead of executing them; the servlet container performs the forward.
        assertThat(mvc.get().uri("/")).hasStatusOk().hasForwardedUrl("/index.html");
        assertThat(mvc.get().uri("/index.html")).hasStatusOk().bodyText().contains("spa-index");
    }

    @Test
    void hashedAssetsAreCachedForever() {
        assertThat(mvc.get().uri("/main-ABC123.js"))
                .hasStatusOk()
                .headers().hasValue(HttpHeaders.CACHE_CONTROL, "max-age=31536000, public, immutable");
    }

    @Test
    void mediaFilesAreServedAndCachedForever() {
        assertThat(mvc.get().uri("/media/icons-XYZ789.woff2"))
                .hasStatusOk()
                .hasHeader("Cache-Control", "max-age=31536000, public, immutable")
                .hasBodyTextEqualTo("font-bytes");
        assertThat(mvc.get().uri("/media/missing.woff2")).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void missingFilesAndApiPathsAreNotFound() {
        assertThat(mvc.get().uri("/missing.js")).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/unknown")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void actuatorStillWorks() {
        assertThat(mvc.get().uri("/actuator/health")).hasStatusOk();
    }
}
