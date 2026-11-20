package ru.teacherbox.billing.application;

import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.billing.persistence.PaymentVisibilityRepository;
import ru.teacherbox.identity.api.Guardians;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/**
 * «Оплаты видит только родитель» (ADR-0069, item 10): the teacher hides payments from a student who has a
 * guardian, because the guardian pays. The switch is effective only while the student has a guardian, so an
 * adult student without parents always sees own payments. The guardian's reads are never affected.
 */
@Service
public class PaymentVisibilityService {

    /**
     * The switch as the teacher sees it in the student card.
     *
     * @param guardiansOnly payments are hidden from the student
     * @param hasGuardians the student has a guardian: only then can the switch be turned on
     */
    public record PaymentVisibility(UUID studentId, boolean guardiansOnly, boolean hasGuardians) {
    }

    private final PaymentVisibilityRepository repository;
    private final Guardians guardians;
    private final UserDirectory directory;
    private final Clock clock;

    public PaymentVisibilityService(PaymentVisibilityRepository repository, Guardians guardians,
            UserDirectory directory, Clock clock) {
        this.repository = repository;
        this.guardians = guardians;
        this.directory = directory;
        this.clock = clock;
    }

    /** {@code true} while the student's payments are hidden from the student: switched on and a guardian linked. */
    @Transactional(readOnly = true)
    public boolean hiddenFromStudent(UUID studentId) {
        return repository.isGuardiansOnly(studentId) && hasGuardians(studentId);
    }

    @Transactional(readOnly = true)
    public PaymentVisibility of(UUID studentId) {
        requireStudent(studentId);
        boolean hasGuardians = hasGuardians(studentId);
        return new PaymentVisibility(studentId, hasGuardians && repository.isGuardiansOnly(studentId), hasGuardians);
    }

    /** The teacher switches it; turning it on needs a guardian (422 {@code billing.no-guardian}). */
    @Transactional
    public PaymentVisibility change(UUID studentId, boolean guardiansOnly) {
        requireStudent(studentId);
        boolean hasGuardians = hasGuardians(studentId);
        if (guardiansOnly) {
            if (!hasGuardians) {
                throw new BusinessRuleException("billing.no-guardian",
                        "Payments can be hidden only from a student who has a parent");
            }
            repository.markGuardiansOnly(studentId, clock.instant());
        } else {
            repository.clear(studentId);
        }
        return new PaymentVisibility(studentId, guardiansOnly, hasGuardians);
    }

    /** The last guardian was unlinked: the student sees payments again, and a new guardian does not hide them. */
    @Transactional
    public void guardianUnlinked(UUID studentId) {
        if (!hasGuardians(studentId)) {
            repository.clear(studentId);
        }
    }

    private boolean hasGuardians(UUID studentId) {
        return !guardians.guardiansOf(studentId).isEmpty();
    }

    private void requireStudent(UUID studentId) {
        if (directory.findStudent(studentId).isEmpty()) {
            throw new NotFoundException("student.not-found", "Student not found");
        }
    }
}
