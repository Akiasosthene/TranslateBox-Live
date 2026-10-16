# TranslateBox mobile apps (Android, iOS)

Native shells built with [Capacitor](https://capacitorjs.com). They package the same web app (home, join by code, listener page, console) and talk to your server.

## Server settings

Native apps load the interface from the device, so the server must accept their origins. Add them to `CORS_ORIGINS` in `.env` (comma-separated):

```
CORS_ORIGINS=https://translatebox.duckdns.org,https://localhost,capacitor://localhost
```

## Android (APK)

Automatic: every push runs **Mobile apps** in GitHub Actions and attaches a debug APK (`translatebox-android-debug`) to the run. Set the repository variable `TB_SERVER_URL` (Settings → Secrets and variables → Actions → Variables) to your server address.

Manual (Android Studio, JDK 21):

```bash
cd mobile
npm install
TB_SERVER_URL=https://translatebox.duckdns.org npm run android
```

For the Play Store, build a signed release in Android Studio (Build → Generate Signed App Bundle).

## iOS

Needs a Mac with Xcode and an Apple Developer account (99 USD per year) to sign and publish.

```bash
cd mobile
npm install
npx cap add ios
TB_SERVER_URL=https://translatebox.duckdns.org npm run ios
```

In Xcode, `Info.plist` must contain (the CI job adds them automatically):

- `UIBackgroundModes` → `audio` (keeps the translation playing when the phone is locked),
- `NSMicrophoneUsageDescription` (needed only to present from the app).

## Limits

- Android may pause audio when the app goes to the background on some phones; listeners should keep the app open (the screen stays awake while listening).
- Apple reviews apps that are mostly a website strictly (guideline 4.2). The native background audio helps; plan for possible review feedback.
