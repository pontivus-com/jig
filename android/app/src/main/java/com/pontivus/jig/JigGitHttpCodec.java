package com.pontivus.jig;

import android.util.Base64;

final class JigGitHttpCodec {
    private JigGitHttpCodec() {}

    static byte[] decode(String value) {
        return Base64.decode(value, Base64.DEFAULT);
    }

    static String encode(byte[] value) {
        return Base64.encodeToString(value, Base64.NO_WRAP);
    }
}
