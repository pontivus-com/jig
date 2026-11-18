package com.pontivus.jig;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URL;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name = "JigGitHttp")
public final class JigGitHttpPlugin extends Plugin {
    private final ExecutorService executor =
        Executors.newCachedThreadPool();

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void request(final PluginCall call) {
        if (executor.isShutdown()) {
            call.reject(
                "Native Git HTTP transport is unavailable",
                "GIT_HTTP_UNAVAILABLE"
            );
            return;
        }

        executor.submit(() -> executeRequest(call));
    }

    private void executeRequest(PluginCall call) {
        HttpsURLConnection connection = null;
        try {
            String urlText = call.getString("url");
            String method = call.getString("method", "GET");
            JSObject headers = call.getObject(
                "headers",
                new JSObject()
            );
            String encodedBody = call.getString("data");

            if (urlText == null || urlText.isBlank()) {
                call.reject(
                    "Native Git HTTP URL is required",
                    "GIT_HTTP_INVALID_REQUEST"
                );
                return;
            }
            if (
                !"GET".equals(method) &&
                !"POST".equals(method)
            ) {
                call.reject(
                    "Native Git HTTP supports only GET and POST",
                    "GIT_HTTP_INVALID_REQUEST"
                );
                return;
            }

            URL url = new URL(urlText);
            if (!"https".equalsIgnoreCase(url.getProtocol())) {
                call.reject(
                    "Native Git HTTP requires HTTPS",
                    "GIT_HTTP_INVALID_REQUEST"
                );
                return;
            }
            if (
                url.getUserInfo() != null &&
                !url.getUserInfo().isEmpty()
            ) {
                call.reject(
                    "Native Git HTTP URL must not contain credentials",
                    "GIT_HTTP_INVALID_REQUEST"
                );
                return;
            }

            Map<String, String> requestHeaders =
                stringHeaders(headers);
            byte[] body =
                encodedBody == null
                    ? null
                    : JigGitHttpCodec.decode(encodedBody);

            connection =
                (HttpsURLConnection) url.openConnection();
            JigGitHttpTransport.Result result =
                JigGitHttpTransport.execute(
                    connection,
                    method,
                    requestHeaders,
                    body
                );

            JSObject responseHeaders = new JSObject();
            for (
                Map.Entry<String, String> header :
                    result.headers.entrySet()
            ) {
                responseHeaders.put(
                    header.getKey(),
                    header.getValue()
                );
            }

            JSObject response = new JSObject();
            response.put("url", result.url);
            response.put("status", result.status);
            response.put("headers", responseHeaders);
            response.put(
                "data",
                JigGitHttpCodec.encode(result.data)
            );
            call.resolve(response);
        } catch (Exception ignored) {
            call.reject(
                "Native Git HTTP request failed",
                "GIT_HTTP_FAILED"
            );
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private static Map<String, String> stringHeaders(
        JSObject object
    ) throws Exception {
        Map<String, String> headers =
            new LinkedHashMap<>();
        Iterator<String> keys = object.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            String value = object.getString(key);
            if (value == null) {
                throw new IllegalArgumentException(
                    "Native Git HTTP headers must be strings"
                );
            }
            headers.put(key, value);
        }
        return headers;
    }
}
