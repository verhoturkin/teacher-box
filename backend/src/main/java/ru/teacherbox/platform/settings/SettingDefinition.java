package ru.teacherbox.platform.settings;

import java.util.List;

/**
 * A setting of the portal: an environment variable of {@code .env.example} (ADR-0016).
 *
 * @param name    the variable, e.g. {@code TEACHERBOX_AI_MODEL}
 * @param section the key of the section, e.g. {@code ai}: it opens the section by a link ({@code ?open=ai})
 * @param group   the section in the interface, e.g. «ИИ-помощник»
 * @param title   what it is, in Russian
 * @param hint    how to fill it, in Russian; may be empty
 * @param choices the allowed values of a {@link SettingKind#CHOICE}
 * @param secret  a password, token or key: never shown, only set anew
 * @param access  who may change it
 */
public record SettingDefinition(String name, String section, String group, String title, String hint, SettingKind kind,
        List<String> choices, boolean secret, Access access) {

    /** Who may change the setting. */
    public enum Access {
        /** The administrator in the interface. */
        EDITABLE,
        /** Docker Compose reads it before the portal starts (port, image, limits): only in {@code .env}. */
        DOCKER,
        /**
         * An account: changing it here would give the administrator the teacher's account, i.e. the
         * students' data (ADR-0010), or lock them out; accounts are changed in «Мой аккаунт».
         */
        ACCOUNT
    }

    public SettingDefinition {
        choices = List.copyOf(choices);
    }

    public boolean editable() {
        return access == Access.EDITABLE;
    }
}
