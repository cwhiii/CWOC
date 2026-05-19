package com.cwoc.app.domain.email

import org.bouncycastle.bcpg.ArmoredInputStream
import org.bouncycastle.bcpg.ArmoredOutputStream
import org.bouncycastle.bcpg.SymmetricKeyAlgorithmTags
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.bouncycastle.openpgp.PGPCompressedData
import org.bouncycastle.openpgp.PGPCompressedDataGenerator
import org.bouncycastle.openpgp.PGPEncryptedData
import org.bouncycastle.openpgp.PGPEncryptedDataGenerator
import org.bouncycastle.openpgp.PGPEncryptedDataList
import org.bouncycastle.openpgp.PGPLiteralData
import org.bouncycastle.openpgp.PGPLiteralDataGenerator
import org.bouncycastle.openpgp.PGPObjectFactory
import org.bouncycastle.openpgp.PGPPrivateKey
import org.bouncycastle.openpgp.PGPPublicKey
import org.bouncycastle.openpgp.PGPPublicKeyEncryptedData
import org.bouncycastle.openpgp.PGPPublicKeyRing
import org.bouncycastle.openpgp.PGPPublicKeyRingCollection
import org.bouncycastle.openpgp.PGPSecretKeyRing
import org.bouncycastle.openpgp.PGPSecretKeyRingCollection
import org.bouncycastle.openpgp.PGPUtil
import org.bouncycastle.openpgp.operator.jcajce.JcaKeyFingerprintCalculator
import org.bouncycastle.openpgp.operator.jcajce.JcePBESecretKeyDecryptorBuilder
import org.bouncycastle.openpgp.operator.jcajce.JcePGPDataEncryptorBuilder
import org.bouncycastle.openpgp.operator.jcajce.JcePublicKeyDataDecryptorFactoryBuilder
import org.bouncycastle.openpgp.operator.jcajce.JcePublicKeyKeyEncryptionMethodGenerator
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.security.SecureRandom
import java.security.Security
import java.util.Date

/**
 * Handles PGP encryption and decryption using Bouncy Castle OpenPGP.
 *
 * Used by the email compose flow to encrypt outgoing messages when PGP is enabled,
 * and to decrypt received PGP-encrypted messages when the user provides their password.
 *
 * Requirements: 48.2, 48.7, 49.3, 49.4
 */
object PgpManager {

    init {
        // Register Bouncy Castle provider if not already registered
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(BouncyCastleProvider())
        }
    }

    /**
     * Encrypts plaintext for multiple recipients using their PGP public keys.
     *
     * The output is an ASCII-armored PGP message that can be decrypted by any
     * of the recipients using their corresponding private keys.
     *
     * @param plaintext The message text to encrypt.
     * @param recipientPublicKeys List of ASCII-armored PGP public key strings (one per recipient).
     * @return ASCII-armored PGP encrypted message.
     * @throws PgpEncryptionException if encryption fails (invalid keys, empty recipients, etc.)
     */
    fun encrypt(plaintext: String, recipientPublicKeys: List<String>): String {
        if (recipientPublicKeys.isEmpty()) {
            throw PgpEncryptionException("At least one recipient public key is required.")
        }
        if (plaintext.isEmpty()) {
            throw PgpEncryptionException("Cannot encrypt empty plaintext.")
        }

        try {
            // Parse all recipient public keys
            val publicKeys = recipientPublicKeys.map { armoredKey ->
                extractEncryptionKey(armoredKey)
                    ?: throw PgpEncryptionException("Failed to extract encryption key from armored public key.")
            }

            // Build the encrypted data generator with AES-256
            val encryptorBuilder = JcePGPDataEncryptorBuilder(SymmetricKeyAlgorithmTags.AES_256)
                .setWithIntegrityPacket(true)
                .setSecureRandom(SecureRandom())
                .setProvider(BouncyCastleProvider.PROVIDER_NAME)

            val encryptedDataGenerator = PGPEncryptedDataGenerator(encryptorBuilder)

            // Add each recipient's public key as an encryption method
            for (publicKey in publicKeys) {
                val keyEncryptionGenerator = JcePublicKeyKeyEncryptionMethodGenerator(publicKey)
                    .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                encryptedDataGenerator.addMethod(keyEncryptionGenerator)
            }

            // Compress the plaintext data
            val compressedBytes = compressData(plaintext.toByteArray(Charsets.UTF_8))

            // Encrypt and armor the output
            val armoredOutput = ByteArrayOutputStream()
            val armoredStream = ArmoredOutputStream(armoredOutput)

            val encryptedStream = encryptedDataGenerator.open(armoredStream, compressedBytes.size.toLong())
            encryptedStream.write(compressedBytes)
            encryptedStream.close()

            armoredStream.close()

            return armoredOutput.toString(Charsets.UTF_8.name())
        } catch (e: PgpEncryptionException) {
            throw e
        } catch (e: Exception) {
            throw PgpEncryptionException("PGP encryption failed: ${e.message}", e)
        }
    }

    /**
     * Decrypts an ASCII-armored PGP encrypted message using the recipient's private key.
     *
     * @param ciphertext The ASCII-armored PGP encrypted message.
     * @param privateKey The ASCII-armored PGP private (secret) key, optionally passphrase-protected.
     * @param passphrase The passphrase to unlock the private key (empty string if no passphrase).
     * @return The decrypted plaintext message.
     * @throws PgpDecryptionException if decryption fails (wrong key, corrupted message, bad passphrase, etc.)
     */
    fun decrypt(ciphertext: String, privateKey: String, passphrase: String = ""): String {
        if (ciphertext.isBlank()) {
            throw PgpDecryptionException("Cannot decrypt empty ciphertext.")
        }
        if (privateKey.isBlank()) {
            throw PgpDecryptionException("Private key is required for decryption.")
        }

        try {
            // Parse the secret key ring
            val secretKeyRingCollection = parseSecretKeyRingCollection(privateKey)

            // Parse the encrypted message
            val encryptedDataList = parseEncryptedDataList(ciphertext)

            // Find the matching encrypted data packet and decrypt
            val encryptedDataIterator = encryptedDataList.encryptedDataObjects
            var decryptedData: ByteArray? = null

            while (encryptedDataIterator.hasNext()) {
                val encryptedData = encryptedDataIterator.next()
                if (encryptedData !is PGPPublicKeyEncryptedData) continue

                val keyId = encryptedData.keyID
                val secretKey = secretKeyRingCollection.getSecretKey(keyId) ?: continue

                // Decrypt the secret key with the passphrase
                val decryptor = JcePBESecretKeyDecryptorBuilder()
                    .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                    .build(passphrase.toCharArray())

                val pgpPrivateKey: PGPPrivateKey = secretKey.extractPrivateKey(decryptor)

                // Decrypt the data
                val decryptorFactory = JcePublicKeyDataDecryptorFactoryBuilder()
                    .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                    .build(pgpPrivateKey)

                val clearStream = encryptedData.getDataStream(decryptorFactory)
                val plainFactory = PGPObjectFactory(clearStream, JcaKeyFingerprintCalculator())

                decryptedData = extractLiteralData(plainFactory)

                // Verify integrity if available
                if (encryptedData.isIntegrityProtected && !encryptedData.verify()) {
                    throw PgpDecryptionException("Message integrity check failed.")
                }

                break
            }

            if (decryptedData == null) {
                throw PgpDecryptionException("No matching private key found for this encrypted message.")
            }

            return String(decryptedData, Charsets.UTF_8)
        } catch (e: PgpDecryptionException) {
            throw e
        } catch (e: Exception) {
            throw PgpDecryptionException("PGP decryption failed: ${e.message}", e)
        }
    }

    /**
     * Extracts the first encryption-capable public key from an armored public key string.
     */
    private fun extractEncryptionKey(armoredPublicKey: String): PGPPublicKey? {
        val inputStream: InputStream = ByteArrayInputStream(armoredPublicKey.toByteArray(Charsets.UTF_8))
        val decoderStream = PGPUtil.getDecoderStream(inputStream)
        val keyRingCollection = PGPPublicKeyRingCollection(decoderStream, JcaKeyFingerprintCalculator())

        for (keyRing: PGPPublicKeyRing in keyRingCollection) {
            val keys = keyRing.publicKeys
            while (keys.hasNext()) {
                val key = keys.next()
                if (key.isEncryptionKey) {
                    return key
                }
            }
        }
        return null
    }

    /**
     * Parses an armored secret key string into a PGPSecretKeyRingCollection.
     */
    private fun parseSecretKeyRingCollection(armoredPrivateKey: String): PGPSecretKeyRingCollection {
        val inputStream: InputStream = ByteArrayInputStream(armoredPrivateKey.toByteArray(Charsets.UTF_8))
        val decoderStream = PGPUtil.getDecoderStream(inputStream)
        return PGPSecretKeyRingCollection(decoderStream, JcaKeyFingerprintCalculator())
    }

    /**
     * Parses an armored ciphertext into a PGPEncryptedDataList.
     */
    private fun parseEncryptedDataList(armoredCiphertext: String): PGPEncryptedDataList {
        val inputStream: InputStream = ByteArrayInputStream(armoredCiphertext.toByteArray(Charsets.UTF_8))
        val decoderStream = PGPUtil.getDecoderStream(inputStream)
        val factory = PGPObjectFactory(decoderStream, JcaKeyFingerprintCalculator())

        var obj = factory.nextObject()
        while (obj != null) {
            if (obj is PGPEncryptedDataList) {
                return obj
            }
            obj = factory.nextObject()
        }
        throw PgpDecryptionException("No encrypted data found in the message.")
    }

    /**
     * Extracts the literal data (plaintext bytes) from a PGP object factory,
     * handling compressed data layers.
     */
    private fun extractLiteralData(factory: PGPObjectFactory): ByteArray {
        var obj = factory.nextObject()
        while (obj != null) {
            when (obj) {
                is PGPCompressedData -> {
                    val compressedFactory = PGPObjectFactory(
                        obj.dataStream,
                        JcaKeyFingerprintCalculator()
                    )
                    return extractLiteralData(compressedFactory)
                }
                is PGPLiteralData -> {
                    return obj.inputStream.readBytes()
                }
            }
            obj = factory.nextObject()
        }
        throw PgpDecryptionException("No literal data found in decrypted message.")
    }

    /**
     * Compresses data using PGP ZIP compression before encryption.
     */
    private fun compressData(data: ByteArray): ByteArray {
        val compressedOutput = ByteArrayOutputStream()
        val compressor = PGPCompressedDataGenerator(PGPCompressedData.ZIP)
        val compressedStream = compressor.open(compressedOutput)

        val literalDataGenerator = PGPLiteralDataGenerator()
        val literalStream = literalDataGenerator.open(
            compressedStream,
            PGPLiteralData.UTF8,
            "message",
            data.size.toLong(),
            Date()
        )
        literalStream.write(data)
        literalStream.close()

        compressor.close()
        return compressedOutput.toByteArray()
    }
}

/**
 * Exception thrown when PGP encryption fails.
 */
class PgpEncryptionException(message: String, cause: Throwable? = null) : Exception(message, cause)

/**
 * Exception thrown when PGP decryption fails.
 */
class PgpDecryptionException(message: String, cause: Throwable? = null) : Exception(message, cause)
