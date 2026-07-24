package com.cryptosugarbabes.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;

import org.json.JSONObject;

public final class MainActivity extends ComponentActivity {
    public static final String EXTRA_PATH = "com.cryptosugarbabes.app.PATH";
    public static final String CHANNEL_MESSAGES = "private_messages";
    private static final int FILE_CHOOSER_REQUEST = 41;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 42;

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(11, 8, 11));
        getWindow().setNavigationBarColor(Color.rgb(11, 8, 11));
        createNotificationChannel();

        webView = new WebView(this);
        configureWebView(webView);
        setContentView(webView);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
            }
        });
        loadIntentPath(getIntent());
    }

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        // JavaScript is required by the Next.js client and navigation is restricted to the HTTPS first-party origin.
        //noinspection SetJavaScriptEnabled
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUserAgentString(settings.getUserAgentString() + " CryptoSugarAndroid/" + BuildConfig.VERSION_NAME);
        settings.setSafeBrowsingEnabled(true);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false);
        view.addJavascriptInterface(new NativeBridge(), "CryptoSugarAndroid");
        view.setWebViewClient(new TrustedWebViewClient());
        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    fileChooserCallback = null;
                    return false;
                }
            }
        });
    }

    private void loadIntentPath(Intent intent) {
        String path = intent == null ? null : intent.getStringExtra(EXTRA_PATH);
        webView.loadUrl(BuildConfig.APP_ORIGIN + safePath(path));
    }

    private static String safePath(String value) {
        if (value == null || !value.startsWith("/") || value.startsWith("//") || value.contains("\\")) return "/";
        return value;
    }

    private boolean isTrusted(Uri uri) {
        String host = uri.getHost();
        return "https".equalsIgnoreCase(uri.getScheme())
            && ("cryptosugarbabes.com".equalsIgnoreCase(host) || "www.cryptosugarbabes.com".equalsIgnoreCase(host));
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // A wallet or browser capable of handling the link is not installed.
        }
    }

    private final class TrustedWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isTrusted(uri)) return false;
            openExternal(uri);
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            dispatchPushStatus();
            if (notificationsGranted()) refreshPushToken();
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) {
            handler.cancel();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (!request.isForMainFrame()) return;
            String html = "<!doctype html><meta name=viewport content='width=device-width'><style>body{background:#0b080b;color:#f7eee7;font:16px sans-serif;display:grid;place-items:center;min-height:90vh;text-align:center}a{color:#d4af37}</style><main><h1>Connection unavailable</h1><p>Crypto Sugar could not reach the website.</p><a href='" + BuildConfig.APP_ORIGIN + "'>Try again</a></main>";
            view.loadDataWithBaseURL(BuildConfig.APP_ORIGIN, html, "text/html", "UTF-8", null);
        }
    }

    private final class NativeBridge {
        @JavascriptInterface
        public void requestPushNotifications() {
            runOnUiThread(() -> {
                if (!BuildConfig.FCM_CONFIGURED) {
                    dispatchPushStatus();
                    return;
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !notificationsGranted()) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
                } else {
                    refreshPushToken();
                }
            });
        }

        @JavascriptInterface
        public void refreshPushToken() {
            runOnUiThread(MainActivity.this::refreshPushToken);
        }

        @JavascriptInterface
        public void disablePushNotifications() {
            runOnUiThread(() -> {
                getSharedPreferences("push", MODE_PRIVATE).edit().remove("token").apply();
                if (!BuildConfig.FCM_CONFIGURED || FirebaseApp.getApps(MainActivity.this).isEmpty()) return;
                FirebaseMessaging.getInstance().deleteToken();
            });
        }

        @JavascriptInterface
        public String getAppVersion() {
            return BuildConfig.VERSION_NAME;
        }
    }

    private boolean notificationsGranted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private void refreshPushToken() {
        dispatchPushStatus();
        if (!BuildConfig.FCM_CONFIGURED || !notificationsGranted() || FirebaseApp.getApps(this).isEmpty()) return;
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) return;
            getSharedPreferences("push", MODE_PRIVATE).edit().putString("token", task.getResult()).apply();
            dispatchPushToken(task.getResult());
        });
    }

    private void dispatchPushStatus() {
        if (webView == null) return;
        boolean enabled = BuildConfig.FCM_CONFIGURED && notificationsGranted();
        String script = "window.dispatchEvent(new CustomEvent('crypto-sugar:push-status',{detail:{enabled:"
            + enabled + ",configured:" + BuildConfig.FCM_CONFIGURED + "}}));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void dispatchPushToken(String token) {
        if (webView == null) return;
        String script = "window.dispatchEvent(new CustomEvent('crypto-sugar:push-token',{detail:{token:"
            + JSONObject.quote(token) + ",platform:'ANDROID',appVersion:"
            + JSONObject.quote(BuildConfig.VERSION_NAME) + "}}));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_MESSAGES,
            "Private messages",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alerts when a private message arrives");
        channel.enableVibration(true);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST) refreshPushToken();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        loadIntentPath(intent);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileChooserCallback == null) return;
        fileChooserCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
        fileChooserCallback = null;
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("CryptoSugarAndroid");
            webView.destroy();
        }
        super.onDestroy();
    }
}
