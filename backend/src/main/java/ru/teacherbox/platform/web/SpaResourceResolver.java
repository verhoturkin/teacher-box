package ru.teacherbox.platform.web;

import java.io.IOException;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the bundled Angular application: existing files are returned as is, client-side routes
 * (paths without a file extension) fall back to {@code index.html}. API and actuator paths never
 * fall back, so unknown API calls still end with 404.
 */
final class SpaResourceResolver extends PathResourceResolver {

    static final String INDEX = "index.html";

    @Override
    protected @Nullable Resource getResource(String resourcePath, Resource location) throws IOException {
        Resource requested = location.createRelative(resourcePath);
        if (!resourcePath.isEmpty() && requested.isReadable()) {
            return requested;
        }
        if (!isClientRoute(resourcePath)) {
            return null;
        }
        Resource index = location.createRelative(INDEX);
        return index.isReadable() ? index : null;
    }

    static boolean isClientRoute(String path) {
        if (path.startsWith("api/") || path.equals("api") || path.startsWith("actuator")) {
            return false;
        }
        String lastSegment = path.substring(path.lastIndexOf('/') + 1);
        return !lastSegment.contains(".");
    }
}
