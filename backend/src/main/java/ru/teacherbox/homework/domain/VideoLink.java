package ru.teacherbox.homework.domain;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A link to a video (ADR-0047): YouTube, Rutube and VK Video are played inside the portal, any other http(s) link
 * opens in a new tab.
 *
 * @param videoId      the video on its platform ({@code -123_456} for VK); {@code null} for {@link Provider#OTHER}
 * @param startSeconds where to start playing ({@code t=} of a YouTube link); {@code null} — from the beginning
 */
public record VideoLink(String url, Provider provider, @Nullable String videoId, @Nullable Integer startSeconds) {

    public static final int MAX_URL = 500;

    public enum Provider {
        YOUTUBE,
        RUTUBE,
        VK,
        OTHER
    }

    private static final Pattern YOUTUBE_ID = Pattern.compile("[A-Za-z0-9_-]{11}");
    private static final Pattern YOUTUBE_PATH = Pattern.compile("^/(?:shorts|embed|live|v)/([A-Za-z0-9_-]{11})");
    private static final Pattern RUTUBE_PATH = Pattern.compile("^/(?:video|play/embed|shorts)/([0-9a-f]{32})",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern VK_VIDEO = Pattern.compile("video(-?\\d+_\\d+)");
    private static final Pattern VK_EXT_OID = Pattern.compile("(?:^|&)oid=(-?\\d+)");
    private static final Pattern VK_EXT_ID = Pattern.compile("(?:^|&)id=(\\d+)");
    private static final Pattern TIME = Pattern.compile("^(?:(\\d+)h)?(?:(\\d+)m)?(?:(\\d+)s?)?$");

    /**
     * @throws BusinessRuleException {@code video.link-invalid} if the text is not an http(s) link
     */
    public static VideoLink parse(String text) {
        String url = text.strip();
        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException e) {
            throw invalid();
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (url.length() > MAX_URL || !(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null) {
            throw invalid();
        }
        String host = uri.getHost().toLowerCase(Locale.ROOT).replaceFirst("^(www\\.|m\\.)", "");
        String path = uri.getPath() == null ? "" : uri.getPath();
        String query = uri.getRawQuery() == null ? "" : uri.getRawQuery();
        VideoLink found = switch (host) {
            case "youtube.com", "youtube-nocookie.com", "music.youtube.com" -> youtube(url, path, query, false);
            case "youtu.be" -> youtube(url, path, query, true);
            case "rutube.ru" -> rutube(url, path);
            case "vk.com", "vkvideo.ru", "vk.ru" -> vk(url, path, query);
            default -> null;
        };
        return found == null ? new VideoLink(url, Provider.OTHER, null, null) : found;
    }

    private static @Nullable VideoLink youtube(String url, String path, String query, boolean shortLink) {
        String id = null;
        if (shortLink) {
            String candidate = path.replaceFirst("^/", "");
            id = YOUTUBE_ID.matcher(candidate).matches() ? candidate : null;
        } else if (path.equals("/watch")) {
            String candidate = param(query, "v");
            id = candidate != null && YOUTUBE_ID.matcher(candidate).matches() ? candidate : null;
        } else {
            Matcher matcher = YOUTUBE_PATH.matcher(path);
            id = matcher.find() ? matcher.group(1) : null;
        }
        if (id == null) {
            return null;
        }
        String time = param(query, "t");
        if (time == null) {
            time = param(query, "start");
        }
        return new VideoLink(url, Provider.YOUTUBE, id, seconds(time));
    }

    private static @Nullable VideoLink rutube(String url, String path) {
        Matcher matcher = RUTUBE_PATH.matcher(path);
        return matcher.find() ? new VideoLink(url, Provider.RUTUBE, matcher.group(1).toLowerCase(Locale.ROOT), null)
                : null;
    }

    private static @Nullable VideoLink vk(String url, String path, String query) {
        if (path.startsWith("/video_ext.php")) {
            Matcher oid = VK_EXT_OID.matcher(query);
            Matcher id = VK_EXT_ID.matcher(query);
            return oid.find() && id.find() ? new VideoLink(url, Provider.VK, oid.group(1) + "_" + id.group(1), null)
                    : null;
        }
        // vk.com/video-123_456, vkvideo.ru/video-123_456, also ?z=video-123_456 on a group page
        Matcher matcher = VK_VIDEO.matcher(path + "?" + query);
        return matcher.find() ? new VideoLink(url, Provider.VK, matcher.group(1), null) : null;
    }

    private static @Nullable String param(String query, String name) {
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && pair.substring(0, eq).equals(name)) {
                return pair.substring(eq + 1);
            }
        }
        return null;
    }

    /** {@code 90}, {@code 90s}, {@code 1m30s}, {@code 1h2m3s}; anything else — from the beginning. */
    static @Nullable Integer seconds(@Nullable String time) {
        if (time == null || time.isEmpty()) {
            return null;
        }
        Matcher matcher = TIME.matcher(time);
        if (!matcher.matches()) {
            return null;
        }
        long total = part(matcher.group(1)) * 3600 + part(matcher.group(2)) * 60 + part(matcher.group(3));
        return total == 0 || total > Integer.MAX_VALUE ? null : (int) total;
    }

    private static long part(@Nullable String digits) {
        return digits == null ? 0 : Long.parseLong(digits.length() > 9 ? digits.substring(0, 9) : digits);
    }

    private static BusinessRuleException invalid() {
        return new BusinessRuleException("video.link-invalid", "The video link must be an http(s) address");
    }
}
