# Crypto Sugar Android

This is a small native Android shell for the production Crypto Sugar website. It only keeps `https://cryptosugarbabes.com` inside the app; wallet, explorer, email, and other external links open in an installed handler.

## Local build

1. Open `android-app` in Android Studio, or set `JAVA_HOME` to Android Studio's bundled JBR.
2. For push notifications, create the Firebase Android app with package name `com.cryptosugarbabes.app` and place its unmodified `google-services.json` at `android-app/app/google-services.json`.
3. Run `./gradlew assembleDebug` for a test APK.

The app still builds without `google-services.json`, but push registration remains disabled. Never commit `google-services.json`, a release keystore, or keystore passwords.

## Release safety

- Create one permanent release signing key and keep encrypted, offline backups. Every website-distributed update must be signed with the same key.
- Increment both `versionCode` and `versionName` for every release.
- Publish only a release APK. Debug APKs are for local testing.
- Serve the APK over HTTPS and publish its SHA-256 checksum next to the download.
