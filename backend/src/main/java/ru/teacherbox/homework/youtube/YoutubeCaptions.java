package ru.teacherbox.homework.youtube;

import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import ru.teacherbox.homework.application.VideoCaptions;
import ru.teacherbox.shared.error.BusinessRuleException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Captions of a YouTube video (ADR-0047). The official API gives captions to the owner of the video only, so the
 * portal asks for the player data the YouTube app gets (InnerTube, client {@code ANDROID}) — the list of caption
 * tracks — and downloads the chosen track as timed text. YouTube may change this; then the teacher gets
 * {@code video.captions-failed} and pastes the transcript or loads a subtitle file.
 */
class YoutubeCaptions implements VideoCaptions {

    static final String PLAYER = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
    static final String CLIENT_VERSION = "20.10.38";
    private static final String USER_AGENT = "com.google.android.youtube/" + CLIENT_VERSION
            + " (Linux; U; Android 14) gzip";

    private static final Logger log = LoggerFactory.getLogger(YoutubeCaptions.class);

    /** A caption track of the video. */
    record Track(String url, String language, boolean automatic) {
    }

    private final RestClient http;
    private final JsonMapper json;

    YoutubeCaptions(RestClient http, JsonMapper json) {
        this.http = http;
        this.json = json;
    }

    @Override
    public Captions fetch(String videoId) {
        JsonNode player = player(videoId);
        String status = player.path("playabilityStatus").path("status").asString("");
        if (!status.equals("OK")) {
            log.warn("YouTube player of video {} answered {}", videoId, status);
            throw failed();
        }
        List<Track> tracks = tracks(player);
        Track track = choose(tracks).orElseThrow(
                () -> new BusinessRuleException("video.captions-none", "The video has no captions"));
        String title = player.path("videoDetails").path("title").asString("");
        return new Captions(title.isBlank() ? null : title, track.language(), track.automatic(),
                cues(download(videoId, track)));
    }

    private JsonNode player(String videoId) {
        Map<String, Object> body = Map.of(
                "context", Map.of("client", Map.of("clientName", "ANDROID", "clientVersion", CLIENT_VERSION,
                        "androidSdkVersion", 34, "hl", "en")),
                "videoId", videoId);
        try {
            String answer = http.post()
                    .uri(PLAYER)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("User-Agent", USER_AGENT)
                    .body(json.writeValueAsString(body))
                    .retrieve()
                    .body(String.class);
            return json.readTree(answer == null ? "{}" : answer);
        } catch (RestClientException | JacksonException e) {
            log.warn("YouTube player of video {} is not available: {}", videoId, e.getMessage());
            throw failed();
        }
    }

    private static List<Track> tracks(JsonNode player) {
        List<Track> tracks = new ArrayList<>();
        for (JsonNode track : player.path("captions").path("playerCaptionsTracklistRenderer").path("captionTracks")) {
            String url = track.path("baseUrl").asString("");
            String language = track.path("languageCode").asString("");
            if (url.startsWith("https://www.youtube.com/") && !language.isEmpty()) {
                tracks.add(new Track(url, language, track.path("kind").asString("").equals("asr")));
            }
        }
        return tracks;
    }

    /**
     * The author's captions in the spoken language (the language of the recognized track), else the recognized
     * track, else the author's first track.
     */
    static Optional<Track> choose(List<Track> tracks) {
        Optional<Track> recognized = tracks.stream().filter(Track::automatic).findFirst();
        if (recognized.isPresent()) {
            String spoken = base(recognized.get().language());
            return tracks.stream()
                    .filter(track -> !track.automatic() && base(track.language()).equals(spoken))
                    .findFirst()
                    .or(() -> recognized);
        }
        return tracks.stream().findFirst();
    }

    private static String base(String language) {
        return language.toLowerCase(Locale.ROOT).split("-")[0];
    }

    private String download(String videoId, Track track) {
        try {
            String text = http.get().uri(URI.create(track.url())).header("User-Agent", USER_AGENT).retrieve()
                    .body(String.class);
            if (text == null || text.isBlank()) {
                log.warn("YouTube captions of video {} are empty", videoId);
                throw failed();
            }
            return text;
        } catch (RestClientException | IllegalArgumentException e) {
            log.warn("YouTube captions of video {} are not available: {}", videoId, e.getMessage());
            throw failed();
        }
    }

    /** Timed text: format 3 ({@code <p t="ms">}, words maybe in {@code <s>}) or format 1 ({@code <text start="s">}). */
    static List<Cue> cues(String xml) {
        Document document;
        try {
            document = parser().parse(new InputSource(new StringReader(xml)));
        } catch (SAXException | IOException e) {
            throw failed();
        }
        List<Cue> cues = new ArrayList<>();
        NodeList paragraphs = document.getElementsByTagName("p");
        for (int i = 0; i < paragraphs.getLength(); i++) {
            Element p = (Element) paragraphs.item(i);
            Long start = number(p.getAttribute("t"));
            if (start != null) {
                cues.add(new Cue(start, p.getTextContent()));
            }
        }
        NodeList texts = document.getElementsByTagName("text");
        for (int i = 0; i < texts.getLength(); i++) {
            Element text = (Element) texts.item(i);
            try {
                long start = Math.round(Double.parseDouble(text.getAttribute("start")) * 1000);
                cues.add(new Cue(start, text.getTextContent()));
            } catch (NumberFormatException ignored) {
                // a cue without a time is skipped
            }
        }
        return cues;
    }

    private static @Nullable Long number(String text) {
        try {
            return text.isEmpty() ? null : Long.parseLong(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static DocumentBuilder parser() {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            return factory.newDocumentBuilder();
        } catch (ParserConfigurationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static BusinessRuleException failed() {
        return new BusinessRuleException("video.captions-failed", "YouTube captions could not be read");
    }
}
