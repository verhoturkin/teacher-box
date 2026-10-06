package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.identity.IdentityTestSupport.activeStudent;
import static ru.teacherbox.identity.IdentityTestSupport.login;
import static ru.teacherbox.identity.IdentityTestSupport.signIn;
import static ru.teacherbox.identity.IdentityTestSupport.signInTeacher;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.identity.IdentityTestSupport.ActiveStudent;
import ru.teacherbox.identity.IdentityTestSupport.Tokens;
import ru.teacherbox.identity.application.InviteService;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.identity.domain.Avatar;
import ru.teacherbox.identity.persistence.UserRepository;

/** A student's own name and photo (0.9.1). */
@IdentityIntegrationTest
class OwnProfileIntegrationTests {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 1, 2, 3};

    @Autowired
    MockMvcTester mvc;

    @Autowired
    StudentAdminService students;

    @Autowired
    InviteService invites;

    @Autowired
    UserRepository users;

    @Test
    void theStudentSeesTheirOwnNameAndTheTeacherKeepsTheirs() {
        ActiveStudent student = activeStudent(students, invites, "Вероника Петрова");
        Tokens tokens = signIn(mvc, student.login(), student.password());

        assertThat(renameSelf(tokens, "  Ника "))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.displayName").isEqualTo("Ника");
                    assertThat(json).extractingPath("$.profileName").isEqualTo("Вероника Петрова");
                });
        assertThat(login(mvc, student.login(), student.password()))
                .hasStatusOk().bodyJson().extractingPath("$.user.displayName").isEqualTo("Ника");
        assertThat(mvc.get().uri("/api/teacher/students/" + student.id())
                .header(HttpHeaders.AUTHORIZATION, signInTeacher(mvc).bearer()))
                .hasStatusOk().bodyJson().extractingPath("$.displayName").isEqualTo("Вероника Петрова");

        assertThat(renameSelf(tokens, "я".repeat(101))).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(renameSelf(tokens, ""))
                .hasStatusOk().bodyJson().extractingPath("$.displayName").isEqualTo("Вероника Петрова");
    }

    @Test
    void theTeacherKeepsRenamingThemselvesInTheProfile() {
        assertThat(renameSelf(signInTeacher(mvc), "Аня"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("account.not-student");
    }

    @Test
    void theStudentUploadsReplacesAndRemovesAPhoto() {
        ActiveStudent student = activeStudent(students, invites, "С фото");
        Tokens tokens = signIn(mvc, student.login(), student.password());

        String first = avatarOf(uploadAvatar(tokens, PNG));
        assertThat(first).startsWith("/api/public/avatars/");
        assertThat(mvc.get().uri(first))
                .hasStatusOk()
                .hasContentType(MediaType.IMAGE_PNG)
                .hasHeader("X-Content-Type-Options", "nosniff")
                .hasBodyTextEqualTo(new String(PNG, StandardCharsets.ISO_8859_1));
        assertThat(mvc.get().uri("/api/teacher/students/" + student.id())
                .header(HttpHeaders.AUTHORIZATION, signInTeacher(mvc).bearer()))
                .hasStatusOk().bodyJson().extractingPath("$.avatar").isEqualTo(first);
        assertThat(login(mvc, student.login(), student.password()))
                .hasStatusOk().bodyJson().extractingPath("$.user.avatar").isEqualTo(first);

        String second = avatarOf(uploadAvatar(tokens, JPEG));
        assertThat(second).isNotEqualTo(first);
        assertThat(mvc.get().uri(first)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri(second)).hasStatusOk().hasContentType(MediaType.IMAGE_JPEG);

        assertThat(mvc.delete().uri("/api/me/avatar").header(HttpHeaders.AUTHORIZATION, tokens.bearer()))
                .hasStatusOk().bodyJson().extractingPath("$.avatar").isNull();
        assertThat(mvc.get().uri(second)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(users.findById(student.id()).orElseThrow().avatar()).isNull();
    }

    @Test
    void onlyAnImageOfAtMostOneMegabyteIsAccepted() {
        ActiveStudent student = activeStudent(students, invites, "Шлёт не то");
        Tokens tokens = signIn(mvc, student.login(), student.password());

        assertThat(uploadAvatar(tokens, "<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes(StandardCharsets.UTF_8)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("avatar.invalid");
        byte[] large = new byte[Avatar.MAX_SIZE + 1];
        System.arraycopy(PNG, 0, large, 0, PNG.length);
        assertThat(uploadAvatar(tokens, large))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("avatar.too-large");
    }

    @Test
    void theTeacherHasAPhotoToo() {
        Tokens teacher = signInTeacher(mvc);

        String photo = avatarOf(uploadAvatar(teacher, PNG));

        assertThat(photo).startsWith("/api/public/avatars/");
        assertThat(mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, teacher.bearer()))
                .hasStatusOk().bodyJson().extractingPath("$.avatar").isEqualTo(photo);
        assertThat(mvc.get().uri(photo)).hasStatusOk();
        assertThat(mvc.delete().uri("/api/me/avatar").header(HttpHeaders.AUTHORIZATION, teacher.bearer()))
                .hasStatusOk().bodyJson().extractingPath("$.avatar").isNull();
    }

    @Test
    void strangersGetNothing() {
        assertThat(mvc.perform(multipart(HttpMethod.PUT, "/api/me/avatar").file(new MockMultipartFile("file", PNG))))
                .hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri("/api/public/avatars/0190a3b2-0000-7000-8000-000000000000"))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/public/avatars/..%2F..%2Fsecret")).hasStatus4xxClientError();
    }

    private MvcTestResult renameSelf(Tokens tokens, String name) {
        return mvc.put().uri("/api/me/profile")
                .header(HttpHeaders.AUTHORIZATION, tokens.bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"%s\"}".formatted(name))
                .exchange();
    }

    private MvcTestResult uploadAvatar(Tokens tokens, byte[] content) {
        return mvc.perform(multipart(HttpMethod.PUT, "/api/me/avatar")
                .file(new MockMultipartFile("file", "photo", "application/octet-stream", content))
                .header(HttpHeaders.AUTHORIZATION, tokens.bearer()));
    }

    private static String avatarOf(MvcTestResult result) {
        assertThat(result).hasStatusOk();
        return JsonPath.read(IdentityTestSupport.body(result), "$.avatar");
    }
}
