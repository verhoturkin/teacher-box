package ru.teacherbox.shared.chat;

import java.util.Objects;
import org.jspecify.annotations.Nullable;

/** The result of a step of a dialog. */
public sealed interface ChatStep {

    ChatReply reply();

    /** Asks for more: the next text or button goes to the same action with the {@code state}. */
    record Ask(ChatReply reply, ChatState state) implements ChatStep {

        public Ask {
            Objects.requireNonNull(reply, "reply");
            Objects.requireNonNull(state, "state");
        }
    }

    /**
     * The dialog is over.
     *
     * @param audit what the teacher changed, for the audit log: an action name and ids, no names or
     *              texts (e.g. {@code payment-recorded 0199...}); {@code null} when nothing changed
     */
    record Done(ChatReply reply, @Nullable String audit) implements ChatStep {

        public Done {
            Objects.requireNonNull(reply, "reply");
        }
    }

    static ChatStep ask(ChatReply reply, ChatState state) {
        return new Ask(reply, state);
    }

    static ChatStep done(ChatReply reply) {
        return new Done(reply, null);
    }

    static ChatStep done(String text) {
        return new Done(ChatReply.of(text), null);
    }

    /** The dialog is over and it changed data. */
    static ChatStep changed(ChatReply reply, String audit) {
        return new Done(reply, Objects.requireNonNull(audit, "audit"));
    }
}
