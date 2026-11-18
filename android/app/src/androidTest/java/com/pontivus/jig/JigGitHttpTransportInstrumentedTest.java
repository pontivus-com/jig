package com.pontivus.jig;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.Test;

public final class JigGitHttpTransportInstrumentedTest {
    @Test
    public void codecPreservesRawGitBytesOnMinSdkRuntime() {
        byte[] expected = new byte[] {
            0,
            1,
            2,
            127,
            (byte) 128,
            (byte) 255,
        };

        String encoded = JigGitHttpCodec.encode(expected);
        assertArrayEquals(
            expected,
            JigGitHttpCodec.decode(encoded)
        );
    }

    @Test
    public void transportWritesAndReadsExactBinaryBytes() throws Exception {
        byte[] request = new byte[] {
            0,
            (byte) 255,
            1,
            2,
        };
        byte[] response = new byte[] {
            16,
            32,
            48,
            64,
            (byte) 200,
        };
        FakeConnection connection = new FakeConnection(
            new URL("https://example.invalid/repo.git/git-upload-pack"),
            200,
            response
        );
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put(
            "Content-Type",
            "application/x-git-upload-pack-request"
        );

        JigGitHttpTransport.Result result =
            JigGitHttpTransport.execute(
                connection,
                "POST",
                headers,
                request
            );

        assertArrayEquals(request, connection.requestBytes());
        assertArrayEquals(response, result.data);
        assertEquals(200, result.status);
        assertEquals(
            "application/x-git-upload-pack-result",
            result.headers.get("Content-Type")
        );
        assertEquals("POST", connection.getRequestMethod());
    }

    @Test
    public void transportPreservesBinaryErrorStream() throws Exception {
        byte[] response = new byte[] {
            (byte) 222,
            (byte) 173,
            (byte) 190,
            (byte) 239,
        };
        FakeConnection connection = new FakeConnection(
            new URL("https://example.invalid/private.git/git-receive-pack"),
            401,
            response
        );

        JigGitHttpTransport.Result result =
            JigGitHttpTransport.execute(
                connection,
                "POST",
                new LinkedHashMap<>(),
                new byte[0]
            );

        assertEquals(401, result.status);
        assertArrayEquals(response, result.data);
    }

    private static final class FakeConnection
        extends HttpURLConnection {
        private final ByteArrayOutputStream request =
            new ByteArrayOutputStream();
        private final byte[] response;
        private final int responseCode;

        FakeConnection(
            URL url,
            int responseCode,
            byte[] response
        ) {
            super(url);
            this.responseCode = responseCode;
            this.response = response;
        }

        byte[] requestBytes() {
            return request.toByteArray();
        }

        @Override
        public void disconnect() {}

        @Override
        public boolean usingProxy() {
            return false;
        }

        @Override
        public void connect() {}

        @Override
        public OutputStream getOutputStream() {
            return request;
        }

        @Override
        public InputStream getInputStream() {
            return new ByteArrayInputStream(response);
        }

        @Override
        public InputStream getErrorStream() {
            return responseCode >= 400
                ? new ByteArrayInputStream(response)
                : null;
        }

        @Override
        public int getResponseCode() {
            return responseCode;
        }

        @Override
        public Map<String, List<String>> getHeaderFields() {
            Map<String, List<String>> result =
                new LinkedHashMap<>();
            List<String> values = new ArrayList<>();
            values.add(
                "application/x-git-upload-pack-result"
            );
            result.put("Content-Type", values);
            return result;
        }
    }
}
