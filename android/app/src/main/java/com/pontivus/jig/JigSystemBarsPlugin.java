package com.pontivus.jig;

import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "JigSystemBars")
public final class JigSystemBarsPlugin extends Plugin {
    private static String requiredMode(PluginCall call) {
        String mode = call.getString("mode");
        if (!"light".equals(mode) && !"dark".equals(mode)) {
            throw new IllegalArgumentException(
                "mode must be light or dark"
            );
        }
        return mode;
    }

    @PluginMethod
    public void setAppearance(PluginCall call) {
        try {
            String mode = requiredMode(call);
            String backgroundColor = call.getString("backgroundColor");
            getActivity().runOnUiThread(() -> {
                try {
                    Window window = getActivity().getWindow();
                    boolean light = "light".equals(mode);
                    WindowInsetsControllerCompat controller =
                        WindowCompat.getInsetsController(
                            window,
                            window.getDecorView()
                        );
                    controller.setAppearanceLightStatusBars(light);
                    controller.setAppearanceLightNavigationBars(light);
                    if (
                        backgroundColor != null &&
                        !backgroundColor.trim().isEmpty()
                    ) {
                        int color = Color.parseColor(backgroundColor);
                        window.setStatusBarColor(color);
                        window.setNavigationBarColor(color);
                    }
                    call.resolve();
                } catch (Exception error) {
                    call.reject(
                        "Unable to apply system-bar appearance",
                        error
                    );
                }
            });
        } catch (Exception error) {
            call.reject(
                "Unable to apply system-bar appearance",
                error
            );
        }
    }
}
