package ru.teacherbox.homework.youtube;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import ru.teacherbox.homework.application.VideoCaptions.Captions;
import ru.teacherbox.homework.application.VideoCaptions.Cue;
import ru.teacherbox.homework.youtube.YoutubeCaptions.Track;
import tools.jackson.databind.json.JsonMapper;

class YoutubeCaptionsTest {

    private static final String TRACK = "https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&lang=en";
    private static final String ONE_TRACK = """
            {"playabilityStatus":{"status":"OK"},"captions":{"playerCaptionsTracklistRenderer":{
             "captionTracks":[{"baseUrl":"%s","languageCode":"en"}]}}}""".formatted(TRACK);

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final YoutubeCaptions captions = new YoutubeCaptions(builder.build(), JsonMapper.builder().build());

    @Test
    void readsTheTrackOfTheSpokenLanguage() {
        server.expect(requestTo(YoutubeCaptions.PLAYER))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(containsString("\"videoId\":\"aaaaaaaaaaa\"")))
                .andRespond(withSuccess("""
                        {"playabilityStatus":{"status":"OK"},"videoDetails":{"title":"Present Simple"},
                         "captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[
                           {"baseUrl":"https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&lang=ar","languageCode":"ar"},
                           {"baseUrl":"https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&lang=en-GB","languageCode":"en-GB"},
                           {"baseUrl":"https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&kind=asr","languageCode":"en",
                            "kind":"asr"},
                           {"baseUrl":"https://evil.example/x","languageCode":"de"}]}}}
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&lang=en-GB"))
                .andRespond(withSuccess("""
                        <?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body>
                        <p t="1360" d="1680">We&#39;re no
                        strangers</p><p t="2000"><s>to</s><s t="200"> love</s></p><p d="5">no time</p>
                        </body></timedtext>
                        """, MediaType.TEXT_XML));

        Captions found = captions.fetch("aaaaaaaaaaa");

        assertThat(found.title()).isEqualTo("Present Simple");
        assertThat(found.language()).isEqualTo("en-GB");
        assertThat(found.automatic()).isFalse();
        assertThat(found.cues()).containsExactly(new Cue(1360, "We're no\nstrangers"), new Cue(2000, "to love"));
        server.verify();
    }

    @Test
    void readsTheOldTimedText() {
        assertThat(YoutubeCaptions.cues("""
                <transcript><text start="1.5" dur="2">Hi &amp; bye</text><text start="x">?</text></transcript>
                """)).containsExactly(new Cue(1500, "Hi & bye"));
        assertThatThrownBy(() -> YoutubeCaptions.cues(
                "<!DOCTYPE x [<!ENTITY e SYSTEM 'file:///etc/passwd'>]><p t='1'>&e;</p>"))
                .hasFieldOrPropertyWithValue("code", "video.captions-failed");
    }

    @Test
    void choosesATrack() {
        Track ru = new Track("u1", "ru", false);
        Track asr = new Track("u2", "en", true);
        Track en = new Track("u3", "en-US", false);

        assertThat(YoutubeCaptions.choose(List.of(ru, asr, en))).contains(en);
        assertThat(YoutubeCaptions.choose(List.of(ru, asr))).contains(asr);
        assertThat(YoutubeCaptions.choose(List.of(ru, en))).contains(ru);
        assertThat(YoutubeCaptions.choose(List.of())).isEmpty();
    }

    @Test
    void reportsAVideoThatIsNotPlayable() {
        server.expect(requestTo(YoutubeCaptions.PLAYER)).andRespond(withSuccess("""
                {"playabilityStatus":{"status":"LOGIN_REQUIRED"}}""", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> captions.fetch("aaaaaaaaaaa"))
                .hasFieldOrPropertyWithValue("code", "video.captions-failed");
    }

    @Test
    void reportsAVideoWithoutCaptions() {
        server.expect(requestTo(YoutubeCaptions.PLAYER)).andRespond(withSuccess("""
                {"playabilityStatus":{"status":"OK"}}""", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> captions.fetch("aaaaaaaaaaa"))
                .hasFieldOrPropertyWithValue("code", "video.captions-none");
    }

    @Test
    void reportsABrokenPlayer() {
        server.expect(requestTo(YoutubeCaptions.PLAYER)).andRespond(withServerError());
        assertThatThrownBy(() -> captions.fetch("aaaaaaaaaaa"))
                .hasFieldOrPropertyWithValue("code", "video.captions-failed");

        server.reset();
        server.expect(requestTo(YoutubeCaptions.PLAYER)).andRespond(withSuccess("not json", MediaType.TEXT_PLAIN));
        assertThatThrownBy(() -> captions.fetch("aaaaaaaaaaa"))
                .hasFieldOrPropertyWithValue("code", "video.captions-failed");
    }

    @Test
    void reportsABrokenTrack() {
        for (String answer : List.of("", "<broken")) {
            server.reset();
            server.expect(requestTo(YoutubeCaptions.PLAYER)).andRespond(withSuccess(ONE_TRACK,
                    MediaType.APPLICATION_JSON));
            server.expect(requestTo(TRACK)).andRespond(withSuccess(answer, MediaType.TEXT_XML));
            assertThatThrownBy(() -> captions.fetch("aaaaaaaaaaa"))
                    .hasFieldOrPropertyWithValue("code", "video.captions-failed");
        }
        server.reset();
        server.expect(requestTo(YoutubeCaptions.PLAYER)).andRespond(withSuccess(ONE_TRACK,
                MediaType.APPLICATION_JSON));
        server.expect(requestTo(TRACK)).andRespond(withServerError());
        assertThatThrownBy(() -> captions.fetch("aaaaaaaaaaa"))
                .hasFieldOrPropertyWithValue("code", "video.captions-failed");
    }
}
