package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.identity.application.AccountService;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.identity.domain.Profile;

/** The public facade used by other modules. */
@IdentityIntegrationTest
class UserDirectoryIntegrationTests {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13};

    @Autowired
    UserDirectory directory;

    @Autowired
    StudentAdminService students;

    @Autowired
    AccountService accounts;

    @Autowired
    MockMvcTester mvc;

    @Test
    void knowsTheTeacher() {
        UUID teacherId = IdentityTestSupport.signInTeacher(mvc).userId();

        assertThat(directory.teacherId()).isEqualTo(teacherId);
        assertThat(directory.findStudent(teacherId)).isEmpty();
    }

    @Test
    void givesTheAddressOfTheStudentsPhoto() {
        UUID id = students.create(Profile.named("Ира")).student().id();
        String avatar = accounts.changeAvatar(id, PNG).avatar();

        assertThat(avatar).startsWith(AccountService.AVATAR_PATH);
        assertThat(directory.findStudent(id)).map(StudentSummary::avatar).contains(avatar);
        assertThat(directory.findStudents(List.of(id))).extracting(StudentSummary::avatar).containsExactly(avatar);
    }

    @Test
    void findsStudents() {
        UUID first = students.create(Profile.named("Яна")).student().id();
        UUID second = students.create(Profile.named("Борис")).student().id();
        students.deactivate(second);

        assertThat(directory.findStudent(first))
                .contains(new StudentSummary(first, "Яна", StudentStatus.INVITED));
        assertThat(directory.findStudents(List.of(first, second, UUID.randomUUID())))
                .extracting(StudentSummary::id).containsExactlyInAnyOrder(first, second);
        assertThat(directory.findStudents(List.of())).isEmpty();
        assertThat(directory.currentStudents()).extracting(StudentSummary::id).contains(first).doesNotContain(second);
        assertThat(directory.isCurrentStudent(first)).isTrue();
        assertThat(directory.isCurrentStudent(second)).isFalse();
        assertThat(directory.isCurrentStudent(UUID.randomUUID())).isFalse();
    }
}
