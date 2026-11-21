package com.pontivus.jig;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "JigSecureCredentials")
public final class JigSecureCredentialsPlugin extends Plugin {
    private static final String KEY_ALIAS =
        "com.pontivus.jig.github.credentials.v1";
    private static final String PREFERENCES =
        "jig_secure_credentials_v1";
    private static final String CIPHERTEXT = "ciphertext";
    private static final String IV = "iv";
    private static final String VERSION = "version";
    private static final int CREDENTIAL_VERSION = 1;
    private static final int GCM_TAG_BITS = 128;

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(
            PREFERENCES,
            Context.MODE_PRIVATE
        );
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        KeyStore.Entry existing = store.getEntry(KEY_ALIAS, null);
        if (existing instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) existing).getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        );
        generator.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT |
                    KeyProperties.PURPOSE_DECRYPT
            )
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(
                    KeyProperties.ENCRYPTION_PADDING_NONE
                )
                .build()
        );
        return generator.generateKey();
    }

    private static String requiredString(
        JSObject object,
        String key
    ) {
        String value = object.getString(key);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(key + " is required");
        }
        return value;
    }

    private static long requiredPositiveLong(
        JSObject object,
        String key
    ) throws JSONException {
        Long value = object.getLong(key);
        if (value == null || value.longValue() <= 0L) {
            throw new IllegalArgumentException(
                key + " must be a positive integer"
            );
        }
        return value.longValue();
    }

    private static JSONObject credentialPayload(
        PluginCall call
    ) throws JSONException {
        JSObject credential = call.getObject("credential");
        if (credential == null) {
            throw new IllegalArgumentException(
                "credential is required"
            );
        }

        JSONObject payload = new JSONObject();
        payload.put(
            "user_id",
            requiredPositiveLong(credential, "user_id")
        );
        payload.put(
            "access_token",
            requiredString(credential, "access_token")
        );

        String refreshToken = credential.getString("refresh_token");
        payload.put(
            "refresh_token",
            refreshToken == null
                ? JSONObject.NULL
                : refreshToken
        );

        String accessExpiry = credential.getString(
            "access_token_expires_at"
        );
        payload.put(
            "access_token_expires_at",
            accessExpiry == null
                ? JSONObject.NULL
                : accessExpiry
        );

        String refreshExpiry = credential.getString(
            "refresh_token_expires_at"
        );
        payload.put(
            "refresh_token_expires_at",
            refreshExpiry == null
                ? JSONObject.NULL
                : refreshExpiry
        );
        return payload;
    }

    @PluginMethod
    public void store(PluginCall call) {
        try {
            byte[] plaintext = credentialPayload(call)
                .toString()
                .getBytes(StandardCharsets.UTF_8);
            Cipher cipher = Cipher.getInstance(
                "AES/GCM/NoPadding"
            );
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] ciphertext = cipher.doFinal(plaintext);
            byte[] iv = cipher.getIV();

            boolean committed = preferences()
                .edit()
                .putInt(VERSION, CREDENTIAL_VERSION)
                .putString(
                    CIPHERTEXT,
                    Base64.encodeToString(
                        ciphertext,
                        Base64.NO_WRAP
                    )
                )
                .putString(
                    IV,
                    Base64.encodeToString(iv, Base64.NO_WRAP)
                )
                .commit();
            if (!committed) {
                call.reject(
                    "Unable to persist GitHub credential"
                );
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject(
                "Unable to store GitHub credential",
                error
            );
        }
    }

    @PluginMethod
    public void load(PluginCall call) {
        try {
            SharedPreferences preferences = preferences();
            String encodedCiphertext = preferences.getString(
                CIPHERTEXT,
                null
            );
            String encodedIv = preferences.getString(IV, null);
            if (
                encodedCiphertext == null ||
                encodedIv == null
            ) {
                JSObject result = new JSObject();
                result.put("credential", JSONObject.NULL);
                call.resolve(result);
                return;
            }
            if (
                preferences.getInt(VERSION, 0) !=
                    CREDENTIAL_VERSION
            ) {
                call.reject(
                    "Stored GitHub credential version is unsupported"
                );
                return;
            }

            byte[] ciphertext = Base64.decode(
                encodedCiphertext,
                Base64.NO_WRAP
            );
            byte[] iv = Base64.decode(
                encodedIv,
                Base64.NO_WRAP
            );
            Cipher cipher = Cipher.getInstance(
                "AES/GCM/NoPadding"
            );
            cipher.init(
                Cipher.DECRYPT_MODE,
                key(),
                new GCMParameterSpec(GCM_TAG_BITS, iv)
            );
            String plaintext = new String(
                cipher.doFinal(ciphertext),
                StandardCharsets.UTF_8
            );
            JSONObject credential = new JSONObject(plaintext);
            JSObject result = new JSObject();
            result.put("credential", credential);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(
                "Unable to load GitHub credential",
                error
            );
        }
    }

    @PluginMethod
    public void delete(PluginCall call) {
        try {
            if (!preferences().edit().clear().commit()) {
                call.reject(
                    "Unable to delete GitHub credential"
                );
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject(
                "Unable to delete GitHub credential",
                error
            );
        }
    }
}
