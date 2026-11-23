package ru.teacherbox.textbooks;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;
import ru.teacherbox.textbooks.api.VideoCaptions;

/** Captions of YouTube videos for transcripts (ADR-0047), taken through the textbooks API. */
@TextbooksIntegrationTest
class VideoCaptionsIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeVideoCaptions captions;

    @Test
    void takesTheCaptionsOfAYoutubeVideo() {
        captions.put("aaaaaaaaaaa", new VideoCaptions.Captions("Урок", "en", true, List.of(
                new VideoCaptions.Cue(1_000, "Hello"), new VideoCaptions.Cue(5_000, "class"),
                new VideoCaptions.Cue(40_000, "Bye")), false), new VideoCaptions.Captions("Урок", "ru", false, List.of(
                new VideoCaptions.Cue(2_000, "Привет")), false));

        assertThat(post("/api/teacher/textbooks/videos/captions", "{\"url\":\"https://youtu.be/aaaaaaaaaaa\"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Урок");
                    assertThat(json).extractingPath("$.tracks[1].language").isEqualTo("ru");
                    assertThat(json).extractingPath("$.tracks[1].automatic").isEqualTo(false);
                    assertThat(json).extractingPath("$.suggested.language").isEqualTo("en");
                });
        assertThat(post("/api/teacher/textbooks/videos/transcript",
                "{\"url\":\"https://youtu.be/aaaaaaaaaaa\",\"language\":\"ru\",\"automatic\":false}"))
                .hasStatusOk().bodyJson().extractingPath("$.transcript").isEqualTo("[0:02] Привет");
        assertThat(post("/api/teacher/textbooks/videos/transcript",
                "{\"url\":\"https://youtu.be/aaaaaaaaaaa\",\"language\":\"de\",\"automatic\":false}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("video.captions-none");

        assertThat(post("/api/teacher/textbooks/videos/transcript", "{\"url\":\"https://youtu.be/aaaaaaaaaaa\"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Урок");
                    assertThat(json).extractingPath("$.language").isEqualTo("en");
                    assertThat(json).extractingPath("$.automatic").isEqualTo(true);
                    assertThat(json).extractingPath("$.transcript").isEqualTo("[0:01] Hello class\n[0:40] Bye");
                    assertThat(json).extractingPath("$.truncated").isEqualTo(false);
                    assertThat(json).extractingPath("$.otherTracks").isEqualTo(true);
                });
        assertThat(post("/api/teacher/textbooks/videos/transcript", "{\"url\":\"https://youtu.be/bbbbbbbbbbb\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("video.captions-none");
        assertThat(post("/api/teacher/textbooks/videos/transcript", "{\"url\":\"https://rutube.ru/video/1/\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("video.not-youtube");

        UUID student = directory.addStudent("Сева");
        assertThat(mvc.post().uri("/api/teacher/textbooks/videos/transcript").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"url\":\"https://youtu.be/aaaaaaaaaaa\"}"))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri("/api/teacher/textbooks/videos/captions").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"url\":\"https://youtu.be/aaaaaaaaaaa\"}"))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private MvcTestResult post(String uri, String json) {
        return mvc.post().uri(uri).with(TestUsers.teacher(directory.teacherId())).contentType(MediaType.APPLICATION_JSON)
                .content(json).exchange();
    }
}
