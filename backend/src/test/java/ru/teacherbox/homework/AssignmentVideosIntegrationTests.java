package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.homework.application.VideoCaptions;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** Videos of an assignment by link (ADR-0047). */
@HomeworkIntegrationTest
class AssignmentVideosIntegrationTests {

    private static final String VIDEOS = """
            [{"url":"https://youtu.be/dQw4w9WgXcQ?t=1m5s","title":"Песня","transcript":"[0:18] We're no strangers",
              "transcriptShown":false},
             {"url":"https://rutube.ru/video/0123456789abcdef0123456789abcdef/","transcript":"[0:00] Привет",
              "transcriptShown":true},
             {"url":"https://example.com/lesson.mp4","transcriptShown":false}]
            """;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeVideoCaptions captions;

    @Test
    void savesVideosWithTheAssignment() {
        UUID student = directory.addStudent("Кира");

        MvcTestResult created = post("/api/teacher/homework/assignments", """
                {"title":"Видео","studentIds":["%s"],"videos":%s}
                """.formatted(student, VIDEOS));

        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.videos[*].provider").asArray()
                    .containsExactly("YOUTUBE", "RUTUBE", "OTHER");
            assertThat(json).extractingPath("$.videos[0].videoId").isEqualTo("dQw4w9WgXcQ");
            assertThat(json).extractingPath("$.videos[0].startSeconds").isEqualTo(65);
            assertThat(json).extractingPath("$.videos[0].title").isEqualTo("Песня");
            assertThat(json).extractingPath("$.videos[0].transcript").isEqualTo("[0:18] We're no strangers");
            assertThat(json).extractingPath("$.videos[1].videoId").isEqualTo("0123456789abcdef0123456789abcdef");
            assertThat(json).extractingPath("$.videos[2].videoId").isNull();
        });
        String id = JsonPath.read(AssignmentIntegrationTests.body(created), "$.id");
        String taskId = JsonPath.read(AssignmentIntegrationTests.body(created), "$.tasks[0].taskId");

        // The student sees the transcript only where the teacher shows it.
        assertThat(mvc.get().uri("/api/me/homework/tasks/" + taskId).with(TestUsers.student(student)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.assignment.videos[*].url").asArray().hasSize(3);
                    assertThat(json).extractingPath("$.assignment.videos[0].transcript").isNull();
                    assertThat(json).extractingPath("$.assignment.videos[1].transcript").isEqualTo("[0:00] Привет");
                });

        // Without «videos» an update keeps them; a list replaces them.
        assertThat(put("/api/teacher/homework/assignments/" + id, "{\"title\":\"Видео 2\",\"version\":0}"))
                .hasStatusOk().bodyJson().extractingPath("$.videos").asArray().hasSize(3);
        assertThat(put("/api/teacher/homework/assignments/" + id, """
                {"title":"Видео 3","version":1,
                 "videos":[{"url":"https://vkvideo.ru/video-123_456","transcriptShown":false}]}
                """))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.videos[*].provider").asArray().containsExactly("VK");
                    assertThat(json).extractingPath("$.videos[0].videoId").isEqualTo("-123_456");
                });

        assertThat(mvc.delete().uri("/api/teacher/homework/assignments/" + id).with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);
    }

    @Test
    void rejectsBadVideos() {
        assertThat(post("/api/teacher/homework/assignments", """
                {"title":"Плохая ссылка","videos":[{"url":"ftp://example.com/v","transcriptShown":false}]}
                """))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("video.link-invalid");

        String six = String.join(",", List.of("1", "2", "3", "4", "5", "6").stream()
                .map(n -> "{\"url\":\"https://example.com/" + n + "\",\"transcriptShown\":false}")
                .toList());
        assertThat(post("/api/teacher/homework/assignments", "{\"title\":\"Много\",\"videos\":[" + six + "]}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void takesTheCaptionsOfAYoutubeVideo() {
        captions.put("aaaaaaaaaaa", new VideoCaptions.Captions("Урок", "en", true, List.of(
                new VideoCaptions.Cue(1_000, "Hello"), new VideoCaptions.Cue(5_000, "class"),
                new VideoCaptions.Cue(40_000, "Bye"))), new VideoCaptions.Captions("Урок", "ru", false, List.of(
                new VideoCaptions.Cue(2_000, "Привет"))));

        assertThat(post("/api/teacher/homework/videos/captions", "{\"url\":\"https://youtu.be/aaaaaaaaaaa\"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Урок");
                    assertThat(json).extractingPath("$.tracks[1].language").isEqualTo("ru");
                    assertThat(json).extractingPath("$.tracks[1].automatic").isEqualTo(false);
                    assertThat(json).extractingPath("$.suggested.language").isEqualTo("en");
                });
        assertThat(post("/api/teacher/homework/videos/transcript",
                "{\"url\":\"https://youtu.be/aaaaaaaaaaa\",\"language\":\"ru\",\"automatic\":false}"))
                .hasStatusOk().bodyJson().extractingPath("$.transcript").isEqualTo("[0:02] Привет");
        assertThat(post("/api/teacher/homework/videos/transcript",
                "{\"url\":\"https://youtu.be/aaaaaaaaaaa\",\"language\":\"de\",\"automatic\":false}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("video.captions-none");

        assertThat(post("/api/teacher/homework/videos/transcript", "{\"url\":\"https://youtu.be/aaaaaaaaaaa\"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Урок");
                    assertThat(json).extractingPath("$.language").isEqualTo("en");
                    assertThat(json).extractingPath("$.automatic").isEqualTo(true);
                    assertThat(json).extractingPath("$.transcript").isEqualTo("[0:01] Hello class\n[0:40] Bye");
                    assertThat(json).extractingPath("$.truncated").isEqualTo(false);
                });
        assertThat(post("/api/teacher/homework/videos/transcript", "{\"url\":\"https://youtu.be/bbbbbbbbbbb\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("video.captions-none");
        assertThat(post("/api/teacher/homework/videos/transcript", "{\"url\":\"https://rutube.ru/video/1/\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("video.not-youtube");

        UUID student = directory.addStudent("Сева");
        assertThat(mvc.post().uri("/api/teacher/homework/videos/transcript").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"url\":\"https://youtu.be/aaaaaaaaaaa\"}"))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri("/api/teacher/homework/videos/captions").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"url\":\"https://youtu.be/aaaaaaaaaaa\"}"))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private MvcTestResult post(String uri, String json) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult put(String uri, String json) {
        return mvc.put().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }
}
