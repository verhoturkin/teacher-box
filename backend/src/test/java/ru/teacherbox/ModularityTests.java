package ru.teacherbox;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModule;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/**
 * Verifies module boundaries (AGENTS.md §4.2): no cycles, access only via named interfaces,
 * only declared dependencies. Also renders module documentation to {@code target/spring-modulith-docs}.
 */
class ModularityTests {

    private static final ApplicationModules MODULES = ApplicationModules.of(TeacherBoxApplication.class);

    @Test
    void moduleBoundariesAreRespected() {
        MODULES.verify();
    }

    @Test
    void platformIsNotUsedByBusinessModules() {
        MODULES.stream()
                .filter(module -> !module.getIdentifier().toString().equals("platform"))
                .forEach(module -> assertThat(module.getBootstrapDependencies(MODULES)
                        .map(ApplicationModule::getIdentifier)
                        .map(Object::toString))
                        .as("module %s must not depend on platform", module.getIdentifier())
                        .doesNotContain("platform"));
    }

    @Test
    void writesModuleDocumentation() {
        new Documenter(MODULES).writeDocumentation();
    }
}
