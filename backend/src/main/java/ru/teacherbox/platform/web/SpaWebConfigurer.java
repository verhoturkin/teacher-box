package ru.teacherbox.platform.web;

import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Static resources of the single-container variant (ADR-0004). Hashed build artifacts are cached
 * for a year, everything else (index.html and client routes) must be revalidated.
 */
final class SpaWebConfigurer implements WebMvcConfigurer {

    private static final String[] HASHED_ASSETS = {"/*.js", "/*.css", "/media/**"};

    private final String location;

    SpaWebConfigurer(String location) {
        this.location = location.endsWith("/") ? location : location + "/";
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // The resource handler rejects an empty path, so the root is forwarded explicitly.
        registry.addViewController("/").setViewName("forward:/" + SpaResourceResolver.INDEX);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(HASHED_ASSETS)
                .addResourceLocations(location)
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());
        registry.addResourceHandler("/**")
                .addResourceLocations(location)
                .setCacheControl(CacheControl.noCache())
                .resourceChain(false)
                .addResolver(new SpaResourceResolver());
    }
}
