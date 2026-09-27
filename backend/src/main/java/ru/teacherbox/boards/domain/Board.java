package ru.teacherbox.boards.domain;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/** A link to an interactive board of a student or a group. */
public record Board(UUID id, BoardOwner ownerType, UUID ownerId, String title, String url, Instant createdAt,
        Instant updatedAt, long version) {

    public static final int MAX_TITLE = 200;
    public static final int MAX_URL = 1000;

    public Board {
        Objects.requireNonNull(id);
        Objects.requireNonNull(ownerType);
        Objects.requireNonNull(ownerId);
        title = validTitle(title);
        url = validUrl(url);
    }

    public static Board added(UUID id, BoardOwner ownerType, UUID ownerId, @Nullable String title, String url,
            Instant now) {
        String link = validUrl(url);
        String name = title == null || title.isBlank() ? (isHolst(link) ? "Доска Холст" : "Доска") : title;
        return new Board(id, ownerType, ownerId, name, link, now, now, 0);
    }

    public Board changed(String newTitle, String newUrl, Instant now) {
        return new Board(id, ownerType, ownerId, newTitle, newUrl, createdAt, now, version);
    }

    /** Whether the link opens a Holst board. */
    public boolean holst() {
        return isHolst(url);
    }

    static boolean isHolst(String url) {
        try {
            String host = new URI(url).getHost();
            return host != null && (host.equals("holst.so") || host.endsWith(".holst.so"));
        } catch (URISyntaxException e) {
            return false;
        }
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
