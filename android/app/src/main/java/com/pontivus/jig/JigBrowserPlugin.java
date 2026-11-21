package com.pontivus.jig;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "JigBrowser")
public final class JigBrowserPlugin extends Plugin {
    private static final String CHROME_PACKAGE = "com.android.chrome";

    @PluginMethod
    public void openChrome(PluginCall call) {
        try {
            String url = call.getString("url");
            if (url == null || url.trim().isEmpty()) {
                throw new IllegalArgumentException("url is required");
            }

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.setPackage(CHROME_PACKAGE);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to open GitHub in Chrome", error);
        }
    }
}
