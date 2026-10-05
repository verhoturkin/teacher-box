package ru.teacherbox.boards;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.modulith.test.Scenario;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import ru.teacherbox.boards.application.LiveTickets;
import ru.teacherbox.identity.api.GroupArchived;
import ru.teacherbox.identity.api.GroupChanged;
import ru.teacherbox.identity.api.StudentDeactivated;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** The live channel of a board over a real WebSocket (ADR-0029): tickets, peers, relay, lost access. */
@ApplicationModuleTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Import(BoardsIntegrationTest.Beans.class)
class BoardLiveIntegrationTests {

    private static final Duration WAIT = Duration.ofSeconds(5);

    @LocalServerPort
    int port;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    LiveTickets tickets;

    @Autowired
    MutableClock clock;

    @Autowired
    JsonMapper json;

    private final List<Editor> editors = new ArrayList<>();

    @AfterEach
    void closeEditors() throws Exception {
        for (Editor editor : editors) {
            if (editor.session.isOpen()) {
                editor.session.close();
            }
        }
    }

    @Test
    void ticketsOnlyForThoseWhoMayOpenTheBoard() {
        UUID member = directory.addStudent("Участник");
        UUID stranger = directory.addStudent("Посторонний");
        String id = board("{\"kind\":\"EXCALIDRAW\",\"title\":\"Живая\",\"studentIds\":[\"%s\"]}".formatted(member));
        String external = board("{\"kind\":\"LINK\",\"title\":\"Холст\",\"url\":\"https://example.com/b\"}");

        assertThat(ticket(teacher(), id)).hasStatusOk().bodyJson().extractingPath("$.ticket").asString()
                .hasSize(43);
        assertThat(ticket(TestUsers.student(member), id)).hasStatusOk();
        assertThat(ticket(TestUsers.student(stranger), id)).as("another student gets 404")
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(ticket(TestUsers.admin(UUID.randomUUID()), id)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri("/api/boards/" + id + "/live")).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(ticket(teacher(), external)).hasStatus(HttpStatus.CONFLICT).bodyJson()
                .extractingPath("$.code").isEqualTo("boards.no-scene");
    }

    @Test
    void theChannelOpensOnceWithAFreshTicket() throws Exception {
        UUID board = UUID.fromString(board("{\"kind\":\"EXCALIDRAW\",\"title\":\"Билет\"}"));
        String ticket = tickets.issue(teacherUser(), board);

        assertThatThrownBy(() -> connect(null)).as("no ticket").hasStackTraceContaining("403");
        assertThatThrownBy(() -> connect("not-a-ticket")).hasStackTraceContaining("403");
        Editor editor = connect(ticket);
        assertThat(editor.next().path("type").asString()).isEqualTo("welcome");
        assertThatThrownBy(() -> connect(ticket)).as("used").hasStackTraceContaining("403");

        String late = tickets.issue(teacherUser(), board);
        clock.advance(Duration.ofSeconds(61));
        assertThatThrownBy(() -> connect(late)).as("expired").hasStackTraceContaining("403");
    }

    @Test
    void editorsSeeEachOtherCursorsAndStrokes() throws Exception {
        UUID student = directory.addStudent("Ученица");
        String id = board("{\"kind\":\"EXCALIDRAW\",\"title\":\"Урок\",\"studentIds\":[\"%s\"]}".formatted(student));
        UUID board = UUID.fromString(id);

        Editor teacher = connect(tickets.issue(teacherUser(), board));
        JsonNode welcome = teacher.next();
        assertThat(welcome.path("peers").size()).isZero();
        String teacherId = welcome.path("you").asString();

        Editor pupil = connect(tickets.issue(new CurrentUser(student, Role.STUDENT, "Ученица"), board));
        JsonNode pupilWelcome = pupil.next();
        assertThat(pupilWelcome.path("peers").get(0).path("name").asString()).isEqualTo("Учитель");
        assertThat(pupilWelcome.path("peers").get(0).path("color").asInt()).isZero();
        String pupilId = pupilWelcome.path("you").asString();
        JsonNode joined = teacher.next();
        assertThat(joined.path("type").asString()).isEqualTo("joined");
        assertThat(joined.path("peer").path("name").asString()).isEqualTo("Ученица");
        assertThat(joined.path("peer").path("color").asInt()).isEqualTo(1);

        pupil.send("not json");
        pupil.send("[1]");
        pupil.send("{\"type\":\"pointer\",\"x\":\"a\",\"y\":1}");
        pupil.send("{\"type\":\"elements\",\"elements\":[{\"id\":\"x\"}]}");
        pupil.send("{\"type\":\"future\"}");
        pupil.send("{\"type\":\"pointer\",\"x\":10.5,\"y\":-3,\"tool\":\"laser\",\"button\":\"down\"}");
        JsonNode pointer = teacher.next();
        assertThat(pointer.path("type").asString()).as("invalid messages are dropped").isEqualTo("pointer");
        assertThat(pointer.path("id").asString()).isEqualTo(pupilId);
        assertThat(pointer.path("x").asDouble()).isEqualTo(10.5);
        assertThat(pointer.path("tool").asString()).isEqualTo("laser");
        assertThat(pointer.path("button").asString()).isEqualTo("down");

        teacher.send("{\"type\":\"pointer\",\"x\":1,\"y\":2,\"tool\":\"pen\"}");
        JsonNode cursor = pupil.next();
        assertThat(cursor.path("id").asString()).isEqualTo(teacherId);
        assertThat(cursor.path("tool").asString()).isEqualTo("pointer");
        assertThat(cursor.path("button").asString()).isEqualTo("up");

        teacher.send("{\"type\":\"elements\",\"elements\":[" + element("e1", 2) + "]}");
        JsonNode elements = pupil.next();
        assertThat(elements.path("type").asString()).isEqualTo("elements");
        assertThat(elements.path("elements").get(0).path("id").asString()).isEqualTo("e1");

        teacher.send("{\"type\":\"ping\"}");
        assertThat(teacher.next().path("type").asString()).isEqualTo("pong");

        assertThat(mvc.put().uri("/api/boards/" + id + "/scene").with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"elements\":[" + element("e1", 2) + "],\"baseVersion\":0}")).hasStatusOk();
        for (Editor editor : List.of(teacher, pupil)) {
            JsonNode saved = editor.next();
            assertThat(saved.path("type").asString()).isEqualTo("saved");
            assertThat(saved.path("sceneVersion").asLong()).isEqualTo(1);
        }

        pupil.session.close();
        JsonNode left = teacher.next();
        assertThat(left.path("type").asString()).isEqualTo("left");
        assertThat(left.path("id").asString()).isEqualTo(pupilId);
        assertThat(teacher.messages.poll(200, TimeUnit.MILLISECONDS)).as("nothing else").isNull();
    }

    @Test
    void whoLosesTheBoardLosesItsChannel(Scenario scenario) throws Exception {
        UUID member = directory.addStudent("Ушедший");
        UUID inGroup = directory.addStudent("Из группы");
        UUID deactivated = directory.addStudent("Отключённый");
        UUID group = groups.addGroup("Группа", inGroup);
        UUID archived = groups.addGroup("Архив", deactivated);
        String id = board("{\"kind\":\"EXCALIDRAW\",\"title\":\"Доступ\",\"studentIds\":[\"%s\",\"%s\"],"
                .formatted(member, deactivated) + "\"groupIds\":[\"%s\",\"%s\"]}".formatted(group, archived));
        UUID board = UUID.fromString(id);
        Editor teacher = connect(tickets.issue(teacherUser(), board));
        Editor leaving = connect(tickets.issue(new CurrentUser(member, Role.STUDENT, "Ушедший"), board));
        Editor grouped = connect(tickets.issue(new CurrentUser(inGroup, Role.STUDENT, "Из группы"), board));
        Editor off = connect(tickets.issue(new CurrentUser(deactivated, Role.STUDENT, "Отключённый"), board));

        assertThat(mvc.put().uri("/api/teacher/boards/" + id).with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Доступ\",\"studentIds\":[\"%s\"],\"groupIds\":[\"%s\",\"%s\"],\"version\":0}"
                        .formatted(deactivated, group, archived)))
                .hasStatusOk();
        await().atMost(WAIT).until(() -> !leaving.session.isOpen());
        assertThat(leaving.closed).isEqualTo(CloseStatus.POLICY_VIOLATION.getCode());
        assertThat(grouped.session.isOpen()).isTrue();

        groups.setMembers(group, List.of());
        scenario.publish(new GroupChanged(group, "Группа", List.of(), List.of(), List.of(inGroup), Instant.now()))
                .andWaitForStateChange(() -> !grouped.session.isOpen())
                .andVerify(closed -> assertThat(closed).isTrue());
        scenario.publish(new GroupArchived(archived, Instant.now()))
                .andWaitForStateChange(() -> teacher.session.isOpen())
                .andVerify(open -> assertThat(open).as("the teacher keeps the board").isTrue());
        scenario.publish(new StudentDeactivated(deactivated, Instant.now()))
                .andWaitForStateChange(() -> !off.session.isOpen())
                .andVerify(closed -> assertThat(closed).isTrue());

        assertThat(mvc.delete().uri("/api/teacher/boards/" + id).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        await().atMost(WAIT).until(() -> !teacher.session.isOpen());
    }

    /** An editor on the other end of the channel: what it got and how it was closed. */
    private final class Editor extends TextWebSocketHandler {

        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        volatile int closed;
        WebSocketSession session;

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            messages.add(message.getPayload());
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            closed = status.getCode();
        }

        JsonNode next() throws InterruptedException {
            String text = messages.poll(WAIT.toMillis(), TimeUnit.MILLISECONDS);
            assertThat(text).as("a message").isNotNull();
            return json.readTree(text);
        }

        void send(String text) throws IOException {
            session.sendMessage(new TextMessage(text));
        }
    }

    private Editor connect(@Nullable String ticket) throws Exception {
        Editor editor = new Editor();
        String query = ticket == null ? "" : "?ticket=" + ticket;
        editor.session = new StandardWebSocketClient()
                .execute(editor, new WebSocketHttpHeaders(),
                        URI.create("ws://localhost:" + port + "/api/public/boards/live" + query))
                .get(5, TimeUnit.SECONDS);
        editors.add(editor);
        return editor;
    }

    private MvcTestResult ticket(RequestPostProcessor user, String id) {
        return mvc.post().uri("/api/boards/" + id + "/live").with(user).exchange();
    }

    private String board(String body) {
        MvcTestResult created = mvc.post().uri("/api/teacher/boards").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
        assertThat(created).hasStatus(HttpStatus.CREATED);
        try {
            return JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String element(String id, int version) {
        return "{\"id\":\"%s\",\"type\":\"rectangle\",\"version\":%d,\"versionNonce\":1,\"isDeleted\":false}"
                .formatted(id, version);
    }

    private CurrentUser teacherUser() {
        return new CurrentUser(directory.teacherId(), Role.TEACHER, "Учитель");
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}
