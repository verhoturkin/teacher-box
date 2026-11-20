package ru.teacherbox.identity.web;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.identity.api.Guardians;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.Role;

/** Who is whose parent, as the student and the guardian see it (ADR-0069). */
@RestController
class FamilyController {

    /** A parent as the student sees them: the name only. */
    record GuardianName(String displayName) {
    }

    private final Guardians guardians;

    FamilyController(Guardians guardians) {
        this.guardians = guardians;
    }

    /** The student's «Родители: Анна» in «Мой аккаунт». */
    @GetMapping("/api/me/guardians")
    List<GuardianName> myGuardians(CurrentUser user) {
        if (user.role() != Role.STUDENT) {
            throw new ForbiddenException("identity.students-only", "Only a student has parents");
        }
        return guardians.guardiansOf(user.id()).stream().map(guardian -> new GuardianName(guardian.displayName()))
                .toList();
    }

    /** The guardian's current children: the child switcher of the family cabinet. */
    @GetMapping("/api/guardian/children")
    List<StudentSummary> children(CurrentUser user) {
        if (!user.isGuardian()) {
            throw new ForbiddenException("access.denied", "Only a guardian has children here");
        }
        return guardians.childrenOf(user.id());
    }
}
