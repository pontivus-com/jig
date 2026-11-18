package com.pontivus.jig;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Map;
import org.json.JSONObject;

@CapacitorPlugin(name = "JigNotificationRegistry")
public final class JigNotificationRegistryPlugin extends Plugin {
    private static final String PREFERENCES =
        "jig_notification_registry_v1";
    private static final String ENTRY_PREFIX = "entry:";
    private static final String NEXT_ID = "next_id";
    private static final int FIRST_NOTIFICATION_ID = 100000;

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(
            PREFERENCES,
            Context.MODE_PRIVATE
        );
    }

    private static String requiredString(
        PluginCall call,
        String key
    ) {
        String value = call.getString(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(key + " is required");
        }
        return value;
    }

    @PluginMethod
    public void list(PluginCall call) {
        try {
            JSArray entries = new JSArray();
            for (
                Map.Entry<String, ?> stored :
                    preferences().getAll().entrySet()
            ) {
                if (!stored.getKey().startsWith(ENTRY_PREFIX)) {
                    continue;
                }
                Object value = stored.getValue();
                if (!(value instanceof String)) {
                    continue;
                }
                JSONObject parsed = new JSONObject((String) value);
                entries.put(parsed);
            }
            JSObject result = new JSObject();
            result.put("entries", entries);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(
                "Unable to read notification registry",
                error
            );
        }
    }

    @PluginMethod
    public void allocate(PluginCall call) {
        try {
            SharedPreferences prefs = preferences();
            int next = prefs.getInt(
                NEXT_ID,
                FIRST_NOTIFICATION_ID
            );
            if (next == Integer.MAX_VALUE) {
                call.reject(
                    "Notification identifier range is exhausted"
                );
                return;
            }
            if (
                !prefs.edit()
                    .putInt(NEXT_ID, next + 1)
                    .commit()
            ) {
                call.reject(
                    "Unable to reserve notification identifier"
                );
                return;
            }
            JSObject result = new JSObject();
            result.put("notification_id", next);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(
                "Unable to reserve notification identifier",
                error
            );
        }
    }

    @PluginMethod
    public void put(PluginCall call) {
        try {
            String taskId = requiredString(call, "task_id");
            String fingerprint = requiredString(
                call,
                "fingerprint"
            );
            Integer notificationId = call.getInt(
                "notification_id"
            );
            if (notificationId == null) {
                throw new IllegalArgumentException(
                    "notification_id is required"
                );
            }

            JSONObject entry = new JSONObject();
            entry.put("task_id", taskId);
            entry.put(
                "notification_id",
                notificationId.intValue()
            );
            entry.put("fingerprint", fingerprint);
            if (
                !preferences()
                    .edit()
                    .putString(
                        ENTRY_PREFIX + taskId,
                        entry.toString()
                    )
                    .commit()
            ) {
                call.reject(
                    "Unable to persist notification registry entry"
                );
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject(
                "Unable to persist notification registry entry",
                error
            );
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        try {
            String taskId = requiredString(call, "task_id");
            if (
                !preferences()
                    .edit()
                    .remove(ENTRY_PREFIX + taskId)
                    .commit()
            ) {
                call.reject(
                    "Unable to remove notification registry entry"
                );
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject(
                "Unable to remove notification registry entry",
                error
            );
        }
    }
}
