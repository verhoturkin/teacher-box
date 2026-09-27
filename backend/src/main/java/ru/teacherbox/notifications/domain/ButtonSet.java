package ru.teacherbox.notifications.domain;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.chat.ChatState;

/**
 * Buttons under one message of the bot (ADR-0013). A button carries only {@code <token>:<index>}
 * (Telegram allows 64 bytes); its value, the action and the state of the dialog stay here. Pressing a
 * button uses up the whole set, so a change cannot be confirmed twice.
 *
 * @param actionId the action that gets the pressed value; {@code null} for buttons of the bot itself
 */
public record ButtonSet(String token, UUID recipientId, ChannelType channel, String externalId,
        @Nullable String actionId, ChatState state, List<String> choices, Instant createdAt, Instant expiresAt) {

    public static final int TOKEN_LENGTH = 12;
    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final Pattern DATA = Pattern.compile("([A-Za-z0-9]{" + TOKEN_LENGTH + "}):(\\d{1,2})");
    private static final SecureRandom RANDOM = new SecureRandom();

    /** A pressed button: the set and the button in it. */
    public record Press(String token, int index) {
    }

    public ButtonSet {
        Objects.requireNonNull(token, "token");
        Objects.requireNonNull(state, "state");
        choices = List.copyOf(choices);
    }

    public static String newToken() {
        StringBuilder token = new StringBuilder(TOKEN_LENGTH);
        for (int i = 0; i < TOKEN_LENGTH; i++) {
            token.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return token.toString();
    }

    /** What a button sends back. */
    public String data(int index) {
        return token + ":" + index;
    }

    public static Optional<Press> parse(String data) {
        Matcher matcher = DATA.matcher(data.strip());
        return matcher.matches()
                ? Optional.of(new Press(matcher.group(1), Integer.parseInt(matcher.group(2))))
                : Optional.empty();
    }

    /** The value of the button, if it was pressed in the chat the set was sent to and in time. */
    public Optional<String> choice(int index, ChannelType fromChannel, String fromExternalId, Instant now) {
        if (channel != fromChannel || !externalId.equals(fromExternalId) || !expiresAt.isAfter(now)
                || index < 0 || index >= choices.size()) {
            return Optional.empty();
        }
        return Optional.of(choices.get(index));
    }
}
