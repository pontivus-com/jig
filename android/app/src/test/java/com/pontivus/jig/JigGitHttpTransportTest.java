package com.pontivus.jig;

import static org.junit.Assert.assertEquals;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Collections;
import org.junit.Test;

public class JigGitHttpTransportTest {
    private static final class FakeConnection
        extends HttpURLConnection {

        FakeConnection() throws Exception {
            super(new URL("https://example.invalid/jig-data.git"));
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
        public int getResponseCode() {
            return 204;
        }

        @Override
        public InputStream getInputStream() {
            return new ByteArrayInputStream(new byte[0]);
        }
    }

    @Test
    public void appliesBoundedConnectAndReadTimeouts()
        throws Exception {
        FakeConnection connection = new FakeConnection();

        JigGitHttpTransport.execute(
            connection,
            "GET",
            Collections.emptyMap(),
            null
        );

        assertEquals(
            JigGitHttpTransport.CONNECT_TIMEOUT_MS,
            connection.getConnectTimeout()
        );
        assertEquals(
            JigGitHttpTransport.READ_TIMEOUT_MS,
            connection.getReadTimeout()
        );
    }
}
