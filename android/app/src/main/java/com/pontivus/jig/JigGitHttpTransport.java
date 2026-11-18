package com.pontivus.jig;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class JigGitHttpTransport {
    static final int CONNECT_TIMEOUT_MS = 15_000;
    static final int READ_TIMEOUT_MS = 30_000;

    static final class Result {
        final String url;
        final int status;
        final Map<String, String> headers;
        final byte[] data;

        Result(
            String url,
            int status,
            Map<String, String> headers,
            byte[] data
        ) {
            this.url = url;
            this.status = status;
            this.headers = headers;
            this.data = data;
        }
    }

    private JigGitHttpTransport() {}

    static Result execute(
        HttpURLConnection connection,
        String method,
        Map<String, String> headers,
        byte[] body
    ) throws Exception {
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setRequestMethod(method);

        for (Map.Entry<String, String> header : headers.entrySet()) {
            connection.setRequestProperty(
                header.getKey(),
                header.getValue()
            );
        }

        if (body != null) {
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(body.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
                output.flush();
            }
        }

        int status = connection.getResponseCode();
        InputStream stream =
            status >= 400
                ? connection.getErrorStream()
                : connection.getInputStream();
        byte[] responseBytes = readFully(stream);

        Map<String, String> responseHeaders =
            new LinkedHashMap<>();
        Map<String, List<String>> rawHeaders =
            connection.getHeaderFields();
        if (rawHeaders != null) {
            for (
                Map.Entry<String, List<String>> header :
                    rawHeaders.entrySet()
            ) {
                String key = header.getKey();
                List<String> values = header.getValue();
                if (
                    key != null &&
                    values != null &&
                    !values.isEmpty()
                ) {
                    responseHeaders.put(
                        key,
                        String.join(", ", values)
                    );
                }
            }
        }

        return new Result(
            connection.getURL().toString(),
            status,
            Collections.unmodifiableMap(responseHeaders),
            responseBytes
        );
    }

    private static byte[] readFully(InputStream stream)
        throws Exception {
        if (stream == null) {
            return new byte[0];
        }
        try (InputStream input = stream) {
            ByteArrayOutputStream output =
                new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }
}
