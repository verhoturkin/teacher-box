package ru.teacherbox.meetings.domain;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Links to video meetings. */
public final class MeetingLinks {

    public static final int MAX_LENGTH = 1000;

    private MeetingLinks() {
    }

    /** A trimmed https (or http) address of a meeting. */
    public static String valid(@Nullable String value) {
        String url = value == null ? "" : value.strip();
        if (url.isEmpty() || url.length() > MAX_LENGTH) {
            throw invalid();
        }
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("https") || scheme.equals("http")) || uri.getHost() == null
                    || uri.getRawUserInfo() != null) {
                throw invalid();
            }
        } catch (URISyntaxException e) {
            throw invalid();
        }
        return url;
    }

    /** Whether the link opens a Telemost meeting (and so the Telemost desktop application). */
    public static boolean isTelemost(String url) {
        try {
            String host = new URI(url).getHost();
            return host != null && (host.equals("telemost.yandex.ru") || host.equals("telemost.360.yandex.ru")
                    || host.endsWith(".telemost.yandex.ru"));
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private static BusinessRuleException invalid() {
        return new BusinessRuleException("meetings.link-invalid", "The link must be an http(s) address");
    }
}
