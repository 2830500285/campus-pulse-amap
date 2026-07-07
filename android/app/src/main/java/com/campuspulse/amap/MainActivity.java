package com.campuspulse.amap;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.WebResourceError;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final int LOCATION_PERMISSION_REQUEST = 1001;
    private static final int MAX_LOAD_RETRY_COUNT = 5;
    private static final long RETRY_BASE_DELAY_MS = 1500L;
    private static final long RETRY_MAX_DELAY_MS = 8000L;

    private WebView webView;
    private String pendingGeolocationOrigin;
    private GeolocationPermissions.Callback pendingGeolocationCallback;
    private int loadRetryCount;
    private boolean mainFrameLoadFailed;
    private boolean retryScheduled;
    private String retryTargetUrl;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        webView.setWebViewClient(new CampusPulseWebViewClient());
        webView.setWebChromeClient(new CampusPulseChromeClient());
        webView.clearCache(true);
        webView.clearHistory();
        webView.loadUrl(BuildConfig.WEB_APP_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }

        super.onBackPressed();
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        String[] permissions,
        int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != LOCATION_PERMISSION_REQUEST || pendingGeolocationCallback == null) {
            return;
        }

        boolean granted = grantResults.length > 0
            && grantResults[0] == PackageManager.PERMISSION_GRANTED;

        pendingGeolocationCallback.invoke(pendingGeolocationOrigin, granted, false);
        pendingGeolocationOrigin = null;
        pendingGeolocationCallback = null;
    }

    private boolean hasLocationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }

        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    private void requestLocationPermission(
        String origin,
        GeolocationPermissions.Callback callback
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            callback.invoke(origin, true, false);
            return;
        }

        pendingGeolocationOrigin = origin;
        pendingGeolocationCallback = callback;
        requestPermissions(
            new String[] {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            },
            LOCATION_PERMISSION_REQUEST
        );
    }

    private class CampusPulseChromeClient extends WebChromeClient {
        @Override
        public void onGeolocationPermissionsShowPrompt(
            String origin,
            GeolocationPermissions.Callback callback
        ) {
            if (hasLocationPermission()) {
                callback.invoke(origin, true, false);
                return;
            }

            requestLocationPermission(origin, callback);
        }
    }

    private class CampusPulseWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleUrl(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUrl(Uri.parse(url));
        }

        private boolean handleUrl(Uri uri) {
            String scheme = uri.getScheme();
            if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                return false;
            }

            startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
            mainFrameLoadFailed = false;

            if (retryTargetUrl == null || !retryTargetUrl.equals(url)) {
                loadRetryCount = 0;
                retryTargetUrl = null;
                retryScheduled = false;
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);

            if (!mainFrameLoadFailed && !retryScheduled) {
                loadRetryCount = 0;
                retryTargetUrl = null;
            }
        }

        @Override
        public void onReceivedError(
            WebView view,
            WebResourceRequest request,
            WebResourceError error
        ) {
            super.onReceivedError(view, request, error);

            if (request.isForMainFrame()) {
                mainFrameLoadFailed = true;
                scheduleRetry(view, request.getUrl().toString());
            }
        }

        @Override
        public void onReceivedHttpError(
            WebView view,
            WebResourceRequest request,
            WebResourceResponse errorResponse
        ) {
            super.onReceivedHttpError(view, request, errorResponse);

            if (request.isForMainFrame() && errorResponse.getStatusCode() >= 500) {
                mainFrameLoadFailed = true;
                scheduleRetry(view, request.getUrl().toString());
            }
        }

        private void scheduleRetry(WebView view, String url) {
            if (retryScheduled || loadRetryCount >= MAX_LOAD_RETRY_COUNT) {
                return;
            }

            retryTargetUrl = url;
            retryScheduled = true;
            loadRetryCount += 1;

            long retryDelayMs = Math.min(
                RETRY_BASE_DELAY_MS * loadRetryCount,
                RETRY_MAX_DELAY_MS
            );

            view.postDelayed(() -> {
                retryScheduled = false;
                view.loadUrl(url);
            }, retryDelayMs);
        }
    }
}
