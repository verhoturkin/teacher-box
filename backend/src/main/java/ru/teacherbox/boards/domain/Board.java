package ru.teacherbox.boards.domain;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A board (ADR-0028): our own Excalidraw board, or an external board by link. Its members are kept
 * apart ({@link BoardMember}).
 *
 * @param url the link of an external board; {@code null} for an Excalidraw board
 */
public record Board(UUID id, BoardKind kind, String title, @Nullable String url, Instant createdAt,
        Instant updatedAt, long version) {

    public static final int MAX_TITLE = 200;
    public static final int MAX_URL = 1000;

    public Board {
        Objects.requireNonNull(id);
        Objects.requireNonNull(kind);
        title = validTitle(title);
        url = kind == BoardKind.LINK ? validUrl(url) : null;
    }

    public static Board created(UUID id, BoardKind kind, String title, @Nullable String url, Instant now) {
        return new Board(id, kind, title, url, now, now, 0);
    }

    /** The kind never changes: an Excalidraw board keeps its scene, an external board its link. */
    public Board changed(String newTitle, @Nullable String newUrl, Instant now) {
        return new Board(id, kind, newTitle, newUrl, createdAt, now, version);
    }

    public boolean excalidraw() {
        return kind == BoardKind.EXCALIDRAW;
    }

    private static String validTitle(@Nullable String value) {
        String title = value == null ? "" : value.strip();
        if (title.isEmpty() || title.length() > MAX_TITLE) {
            throw new BusinessRuleException("boards.title-invalid", "The title must be 1-" + MAX_TITLE + " characters");
        }
        return title;
    }

    private static String validUrl(@Nullable String value) {
        String url = value == null ? "" : value.strip();
        if (url.isEmpty() || url.length() > MAX_URL) {
            throw invalidUrl();
        }
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("https") || scheme.equals("http")) || uri.getHost() == null
                    || uri.getRawUserInfo() != null) {
                throw invalidUrl();
            }
        } catch (URISyntaxException e) {
            throw invalidUrl();
        }
        return url;
    }

    private static BusinessRuleException invalidUrl() {
        return new BusinessRuleException("boards.link-invalid", "The link must be an http(s) address");
    }
}
