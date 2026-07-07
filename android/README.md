# 山科智行 Android WebView App

该目录是 BS 结构中的 Android 客户端壳应用。App 不复制业务页面，只通过 WebView 加载部署后的 GitHub Pages 网址：

```text
https://2830500285.github.io/campus-pulse-amap/#/
```

本地机器当前没有 Android SDK 和 Gradle，因此 APK 由 GitHub Actions 构建。推送到 `main` 后，在 `Build Android WebView App` 工作流的 artifact 中下载 `campus-pulse-debug-apk` 即可。

如需更换页面地址，可在构建时传入：

```bash
gradle :app:assembleDebug -PWEB_APP_URL=https://example.com/#/
```
