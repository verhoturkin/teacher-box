package ru.teacherbox;

import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.shared.notice.NoticeKind;

/**
 * The kinds of notices the modules declare (ADR-0061) are the kinds {@code notifications} knows:
 * a module cannot name them through code — it does not depend on {@code notifications} — so this
 * test does.
 */
class NoticeKindsTests {

    @Test
    void everyKindOfAModuleIsKnownToNotifications() {
        List<String> declared = declared();

        assertThat(declared).isNotEmpty().doesNotHaveDuplicates();
        assertThat(declared).allSatisfy(kind -> assertThat(Arrays.stream(NotificationKind.values()))
                .as("NotificationKind." + kind).anyMatch(known -> known.name().equals(kind)));
    }

    /** Every kind but the teacher's own message, which {@code notifications} sends itself, has its module. */
    @Test
    void everyKindOfNotificationsIsWrittenByAModule() {
        assertThat(Arrays.stream(NotificationKind.values()).filter(kind -> kind != NotificationKind.MESSAGE))
                .extracting(NotificationKind::name)
                .containsExactlyInAnyOrderElementsOf(declared());
    }

    /** The names of every enum of the application that implements {@link NoticeKind}. */
    static List<String> declared() {
        List<String> names = new ArrayList<>();
        for (JavaClass type : new ClassFileImporter().withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("ru.teacherbox")) {
            if (type.isEnum() && type.isAssignableTo(NoticeKind.class)) {
                for (Object kind : type.reflect().getEnumConstants()) {
                    names.add(((NoticeKind) kind).name());
                }
            }
        }
        return names;
    }
}
