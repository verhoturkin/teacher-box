package ru.teacherbox.homework.application;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.AssignmentKind;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.homework.persistence.TaskRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/**
 * The HTML pages of interactive homework (ADR-0040): never part of the portal's own document, they are served by a
 * short-lived signed link with their own policy and shown in a sandboxed frame. The signing key lives in memory, so a
 * restart only ends the links that are open.
 */
@Service
public class InteractivePages {

    public static final String PATH = "/api/public/homework/interactive/";
    static final Duration LIFETIME = Duration.ofMinutes(5);

    /**
     * Put first into every page (after its doctype, so the page keeps the standards mode), before any of its own
     * scripts: reports the height of its content and gives the page {@code teacherbox.result({...})} to report what
     * the student did; the portal checks where a message comes from and its shape.
     */
    static final String BRIDGE = """
            <script>
            (function () {
              var post = function (message) { parent.postMessage(message, '*'); };
              window.teacherbox = {
                result: function (result) { post({ type: 'teacherbox:result', result: result }); }
              };
              var height = function () {
                var content = document.documentElement.getBoundingClientRect().height;
                post({ type: 'teacherbox:height', height: Math.ceil(content) });
              };
              addEventListener('load', height);
              if (window.ResizeObserver) { new ResizeObserver(height).observe(document.documentElement); }
            })();
            </script>
            """;

    private static final Pattern DOCTYPE = Pattern.compile("\\s*<!doctype[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final String ALGORITHM = "HmacSHA256";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    /** A link to the page and when it stops working. */
    public record PageLink(String url, Instant expiresAt) {
    }

    private final AssignmentRepository assignments;
    private final TaskRepository tasks;
    private final Clock clock;
    private final SecretKeySpec key;

    public InteractivePages(AssignmentRepository assignments, TaskRepository tasks, Clock clock) {
        this.assignments = assignments;
        this.tasks = tasks;
        this.clock = clock;
        byte[] secret = new byte[32];
        new SecureRandom().nextBytes(secret);
        this.key = new SecretKeySpec(secret, ALGORITHM);
    }

    /** The teacher's link to the page of an assignment. */
    @Transactional(readOnly = true)
    public PageLink teacherLink(UUID assignmentId) {
        return link(interactive(assignments.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("assignment.not-found", "Assignment not found"))));
    }

    /** The student's link to the page of an own task; a foreign task is not found. */
    @Transactional(readOnly = true)
    public PageLink studentLink(UUID studentId, UUID taskId) {
        HomeworkTask task = tasks.findById(taskId)
                .filter(found -> found.studentId().equals(studentId))
                .orElseThrow(() -> new NotFoundException("task.not-found", "Task not found"));
        return link(interactive(assignments.findById(task.assignmentId())
                .orElseThrow(() -> new NotFoundException("task.not-found", "Task not found"))));
    }

    /**
     * The page a link leads to, with the bridge script.
     *
     * @throws NotFoundException if the link is broken, expired or the assignment is no longer interactive
     */
    @Transactional(readOnly = true)
    public String page(String token) {
        UUID assignmentId = verified(token);
        return assignments.findById(assignmentId)
                .filter(assignment -> assignment.kind() == AssignmentKind.INTERACTIVE)
                .map(assignment -> withBridge(Objects.requireNonNull(assignment.interactiveHtml())))
                .orElseThrow(InteractivePages::notFound);
    }

    static String withBridge(String html) {
        Matcher doctype = DOCTYPE.matcher(html);
        return doctype.lookingAt()
                ? html.substring(0, doctype.end()) + "\n" + BRIDGE + html.substring(doctype.end())
                : BRIDGE + html;
    }

    private PageLink link(Assignment assignment) {
        Instant expiresAt = clock.instant().plus(LIFETIME);
        byte[] payload = ByteBuffer.allocate(24)
                .putLong(assignment.id().getMostSignificantBits())
                .putLong(assignment.id().getLeastSignificantBits())
                .putLong(expiresAt.getEpochSecond())
                .array();
        return new PageLink(PATH + ENCODER.encodeToString(payload) + "." + ENCODER.encodeToString(sign(payload)),
                expiresAt);
    }

    private UUID verified(String token) {
        int dot = token.indexOf('.');
        if (dot < 0) {
            throw notFound();
        }
        byte[] payload;
        byte[] signature;
        try {
            payload = DECODER.decode(token.substring(0, dot));
            signature = DECODER.decode(token.substring(dot + 1));
        } catch (IllegalArgumentException e) {
            throw notFound();
        }
        if (payload.length != 24 || !MessageDigest.isEqual(sign(payload), signature)) {
            throw notFound();
        }
        ByteBuffer buffer = ByteBuffer.wrap(payload);
        UUID assignmentId = new UUID(buffer.getLong(), buffer.getLong());
        if (!clock.instant().isBefore(Instant.ofEpochSecond(buffer.getLong()))) {
            throw notFound();
        }
        return assignmentId;
    }

    private byte[] sign(byte[] payload) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            mac.update("homework-interactive:".getBytes(StandardCharsets.US_ASCII));
            return mac.doFinal(payload);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(ALGORITHM + " is not available", e);
        }
    }

    private static Assignment interactive(Assignment assignment) {
        if (assignment.kind() != AssignmentKind.INTERACTIVE) {
            throw new BusinessRuleException("assignment.not-interactive", "The assignment has no HTML page");
        }
        return assignment;
    }

    private static NotFoundException notFound() {
        return new NotFoundException("homework.page-not-found", "The link has expired");
    }
}
