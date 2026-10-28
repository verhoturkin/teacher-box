package ru.teacherbox.notifications.webpush;

import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECFieldFp;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * The encryption of a push message: the {@code aes128gcm} content coding (RFC 8188) keyed as RFC 8291
 * says, on the crypto of the JDK. One record per message, no padding.
 */
final class WebPushCrypto {

    /** A push service takes at least 4096 bytes: the 86-byte header, the delimiter and the tag are ours. */
    static final int MAX_PLAINTEXT = 4096 - 86 - 1 - 16;

    private static final int RECORD_SIZE = 4096;
    private static final ECParameterSpec P256 = curve();
    private static final SecureRandom RANDOM = new SecureRandom();

    private WebPushCrypto() {
    }

    /** Encrypts for a device: {@code uaPublic} is its {@code p256dh} key, {@code authSecret} its {@code auth}. */
    static byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret) {
        KeyPair ephemeral = newKeyPair();
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return encrypt(plaintext, uaPublic, authSecret, salt, ephemeral.getPrivate(),
                uncompressed((ECPublicKey) ephemeral.getPublic()));
    }

    /** The part without randomness, so that the vectors of the RFC can be reproduced. */
    static byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret, byte[] salt, PrivateKey asPrivate,
            byte[] asPublic) {
        if (plaintext.length > MAX_PLAINTEXT) {
            throw new IllegalArgumentException("Push message is too long: " + plaintext.length + " bytes");
        }
        byte[] ecdh = sharedSecret(asPrivate, publicKey(uaPublic));
        byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic);
        byte[] ikm = expand(hmac(authSecret, ecdh), keyInfo, 32);
        byte[] prk = hmac(salt, ikm);
        byte[] key = expand(prk, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = expand(prk, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
            byte[] sealed = cipher.doFinal(concat(plaintext, new byte[] {2}));
            return ByteBuffer.allocate(21 + asPublic.length + sealed.length)
                    .put(salt).putInt(RECORD_SIZE).put((byte) asPublic.length).put(asPublic).put(sealed).array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    static byte[] sharedSecret(PrivateKey own, PublicKey other) {
        try {
            KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
            agreement.init(own);
            agreement.doPhase(other, true);
            return agreement.generateSecret();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    static KeyPair newKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"));
            return generator.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** A key from its 32-byte scalar. */
    static PrivateKey privateKey(byte[] scalar) {
        try {
            return KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, scalar), P256));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** The 32-byte scalar of a key. */
    static byte[] scalar(PrivateKey key) {
        return fixed(((java.security.interfaces.ECPrivateKey) key).getS());
    }

    /** A key from an uncompressed point; a point off the curve is refused, because the key comes from a browser. */
    static PublicKey publicKey(byte[] point) {
        if (point.length != 65 || point[0] != 4) {
            throw new IllegalArgumentException("Not an uncompressed P-256 point");
        }
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(point, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(point, 33, 65));
        BigInteger p = ((ECFieldFp) P256.getCurve().getField()).getP();
        BigInteger onCurve = x.pow(3).add(P256.getCurve().getA().multiply(x)).add(P256.getCurve().getB()).mod(p);
        if (!y.pow(2).mod(p).equals(onCurve)) {
            throw new IllegalArgumentException("Point is not on the P-256 curve");
        }
        try {
            return KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(new ECPoint(x, y), P256));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** {@code 0x04 || X || Y}, 65 bytes. */
    static byte[] uncompressed(ECPublicKey key) {
        return ByteBuffer.allocate(65).put((byte) 4).put(fixed(key.getW().getAffineX()))
                .put(fixed(key.getW().getAffineY())).array();
    }

    private static byte[] fixed(BigInteger value) {
        byte[] raw = value.toByteArray();
        byte[] result = new byte[32];
        int length = Math.min(raw.length, 32);
        System.arraycopy(raw, raw.length - length, result, 32 - length, length);
        return result;
    }

    /** HKDF-Expand of one block, which is all the RFC needs. */
    private static byte[] expand(byte[] prk, byte[] info, int length) {
        return Arrays.copyOf(hmac(prk, concat(info, new byte[] {1})), length);
    }

    private static byte[] hmac(byte[] key, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] concat(byte[]... parts) {
        ByteBuffer result = ByteBuffer.allocate(Arrays.stream(parts).mapToInt(part -> part.length).sum());
        for (byte[] part : parts) {
            result.put(part);
        }
        return result.array();
    }

    private static ECParameterSpec curve() {
        try {
            AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
            parameters.init(new ECGenParameterSpec("secp256r1"));
            return parameters.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
