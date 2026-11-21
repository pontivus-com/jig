package com.pontivus.jig;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "JigClipboard")
public final class JigClipboardPlugin extends Plugin {
    @PluginMethod
    public void write(PluginCall call) {
        try {
            String text = call.getString("text");
            if (text == null) {
                throw new IllegalArgumentException("text is required");
            }

            Object service = getContext().getSystemService(
                Context.CLIPBOARD_SERVICE
            );
            if (!(service instanceof ClipboardManager)) {
                throw new IllegalStateException(
                    "Android clipboard service is unavailable"
                );
            }

            ClipboardManager clipboard = (ClipboardManager) service;
            clipboard.setPrimaryClip(
                ClipData.newPlainText("Jig device code", text)
            );
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to copy text to the Android clipboard", error);
        }
    }
}
