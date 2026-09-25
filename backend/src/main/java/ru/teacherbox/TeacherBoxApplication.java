package ru.teacherbox;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.modulith.Modulithic;

/**
 * Teacher Box: modular monolith (ADR-0001). The shared kernel and the platform infrastructure are
 * shared modules, i.e. they are bootstrapped in every isolated {@code @ApplicationModuleTest}.
 */
@SpringBootApplication
@Modulithic(sharedModules = {"shared", "platform"})
public class TeacherBoxApplication {

    public static void main(String[] args) {
        SpringApplication.run(TeacherBoxApplication.class, args);
    }
}
