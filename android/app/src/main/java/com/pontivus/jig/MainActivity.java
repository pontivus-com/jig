package com.pontivus.jig;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(JigSqlitePlugin.class);
        registerPlugin(JigGitHttpPlugin.class);
        registerPlugin(JigSecureCredentialsPlugin.class);
        registerPlugin(JigNotificationRegistryPlugin.class);
        registerPlugin(JigSystemBarsPlugin.class);
        registerPlugin(JigClipboardPlugin.class);
        registerPlugin(JigBrowserPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
