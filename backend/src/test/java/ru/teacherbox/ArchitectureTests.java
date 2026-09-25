package ru.teacherbox;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaPackage;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.library.GeneralCodingRules;
import java.util.List;
import org.jspecify.annotations.NullMarked;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.RestController;

/** Code-level architecture rules complementing Spring Modulith verification. */
class ArchitectureTests {

    private static final String ROOT = "ru.teacherbox";
    private static final List<String> BUSINESS_MODULES =
            List.of("identity", "billing", "homework", "notifications", "ai");

    private static final JavaClasses CLASSES = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages(ROOT);

    @Test
    void domainIsFrameworkFree() {
        noClasses().that().resideInAPackage(ROOT + ".(*).domain..")
                .should().dependOnClassesThat().resideInAnyPackage("org.springframework..", "jakarta.persistence..")
                .allowEmptyShould(true)
                .check(CLASSES);
    }

    @Test
    void controllersLiveInWebPackages() {
        classes().that().areAnnotatedWith(RestController.class)
                .should().resideInAPackage("..web..")
                .allowEmptyShould(true)
                .check(CLASSES);
    }

    @Test
    void businessModulesAndSharedKernelDoNotDependOnPlatform() {
        String[] packages = BUSINESS_MODULES.stream().map(m -> ROOT + "." + m + "..").toArray(String[]::new);
        noClasses().that().resideInAnyPackage(packages)
                .or().resideInAPackage(ROOT + ".shared..")
                .should().dependOnClassesThat().resideInAPackage(ROOT + ".platform..")
                .allowEmptyShould(true)
                .check(CLASSES);
    }

    @Test
    void sharedKernelDoesNotDependOnModules() {
        String[] packages = BUSINESS_MODULES.stream().map(m -> ROOT + "." + m + "..").toArray(String[]::new);
        noClasses().that().resideInAPackage(ROOT + ".shared..")
                .should().dependOnClassesThat().resideInAnyPackage(packages)
                .check(CLASSES);
    }

    @Test
    void noFieldInjection() {
        GeneralCodingRules.NO_CLASSES_SHOULD_USE_FIELD_INJECTION.check(CLASSES);
    }

    @Test
    void noJavaUtilLoggingOrStandardStreams() {
        GeneralCodingRules.NO_CLASSES_SHOULD_USE_JAVA_UTIL_LOGGING.check(CLASSES);
        GeneralCodingRules.NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS.check(CLASSES);
    }

    @Test
    void everyPackageIsNullMarked() {
        JavaPackage root = CLASSES.getPackage(ROOT);
        List<String> unmarked = root.getSubpackagesInTree().stream()
                .filter(pkg -> !pkg.getClasses().isEmpty())
                .filter(pkg -> !pkg.isAnnotatedWith(NullMarked.class))
                .map(JavaPackage::getName)
                .toList();
        assertThat(unmarked).as("packages without @NullMarked package-info").isEmpty();
    }
}
