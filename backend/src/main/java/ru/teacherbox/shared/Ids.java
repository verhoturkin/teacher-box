package ru.teacherbox.shared;

import java.security.SecureRandom;
import java.util.UUID;

/**
 * Generates time-ordered UUID version 7 identifiers (RFC 9562).
 */
public final class Ids {

    private static final SecureRandom RANDOM = new SecureRandom();

    private Ids() {
    }

    public static UUID newId() {
        return fromParts(System.currentTimeMillis(), RANDOM.nextLong(), RANDOM.nextLong());
    }

    static UUID fromParts(long epochMillis, long randomA, long randomB) {
        long timestamp = epochMillis & 0xFFFF_FFFF_FFFFL;
        long mostSigBits = (timestamp << 16) | (0x7L << 12) | (randomA & 0x0FFFL);
        long leastSigBits = (randomB & 0x3FFF_FFFF_FFFF_FFFFL) | 0x8000_0000_0000_0000L;
        return new UUID(mostSigBits, leastSigBits);
    }
}
