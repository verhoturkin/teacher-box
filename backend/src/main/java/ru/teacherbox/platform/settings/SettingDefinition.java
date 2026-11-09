package ru.teacherbox.platform.settings;

import java.util.List;

/**
 * A setting of the portal: an environment variable (ADR-0016, ADR-0056).
 *
 * @param name    the variable, e.g. {@code TEACHERBOX_AI_MODEL}
 * @param section the key of the section, e.g. {@code ai}: it opens the section by a link ({@code ?open=ai})
 * @param group   the section in the interface, e.g. «ИИ-помощник»
 * @param title   what it is
 * @param hint    how to fill it; may be empty
 * @param choices the allowed values of a {@link SettingKind#CHOICE}
 * @param secret  a password, token or key: never shown, only set anew
 * @param access  who may change it
 * @param owner   whose setting it is: the teacher's are kept in the portal, not in {@code .env}
 * @param live    a change applies at once, without a restart: its consumers read it on every call
 */
public record SettingDefinition(String name, String section, Wording group, Wording title, Wording hint, SettingKind kind,
        List<String> choices, boolean secret, Access access, Owner owner, boolean live) {

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

    /** Whose setting it is (ADR-0056). */
    public enum Owner {
        /**
         * The teacher's: set in the portal (Settings, the first-run wizard). Not in {@code .env.example} and
         * not among the administrator's settings; {@code .env} is read for it only to import an old value.
         */
        TEACHER,
        /** The administrator's: {@code .env} is optional, the interface overrides it. */
        ADMIN,
        /** Only {@code .env}: Docker Compose, accounts, recovery. */
        ENV_ONLY
    }

    public SettingDefinition {
        choices = List.copyOf(choices);
        if ((owner == Owner.ENV_ONLY) == (access == Access.EDITABLE)) {
            throw new IllegalArgumentException(name + ": only a setting of .env alone is read-only");
        }
        if (live && owner != Owner.ADMIN) {
            throw new IllegalArgumentException(name + ": only the administrator's settings apply live");
        }
    }

    /** The administrator changes it in the interface. */
    public boolean editable() {
        return owner == Owner.ADMIN;
    }

    /**
     * {@link SettingsFile} may hold it: the administrator's settings and the teacher's ones saved there
     * before ADR-0056 (they apply on start until the teacher's own setting replaces them).
     */
    public boolean stored() {
        return access == Access.EDITABLE;
    }
}
