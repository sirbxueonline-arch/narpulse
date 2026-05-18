# NarPulse — iOS app (React Native / Expo)

Companion native app for [NarPulse](../README.md). Built with **Expo Router + React Native + TypeScript**, sharing the same Supabase backend as the web app.

> There's also a pure-SwiftUI version in [`../ios app/`](../ios%20app/) (note the space) — that one runs straight in Xcode without Node tooling. This Expo build is the cross-platform path (iOS + Android), with hot reload and shared TS code style with the web app.

## Features

| Tab | What it does |
|---|---|
| **Kəsintilər** | Live outage map (Apple Maps `mutedStandard`) with utility filter chips, list with utility-colored stripes, Realtime inserts/updates from Supabase, sheet with full details + ETA. |
| **Növbələr** | Service-location markers showing median wait (last 60 min) with severity coloring. Floating legend explains the scale. Tap **Hesabat ver** → modal with big number input + quick chips (0/5/10/15/30/60 min). |
| **Təhlükəsizlik** | Drop-pin flow: tap **Pin əlavə et** → tap map → fill category + description + optional photo (Expo ImagePicker → Supabase Storage). Tap any pin to see details and upvote. |
| **Hesab** | Email + 6-digit OTP sign-in (works across devices, unlike magic links). Shows admin badge if your profile role is `admin`. |

All screens render with **mock Nərimanov data** if Supabase isn't configured, so you can see the UI before wiring backend.

## Setup

You need **macOS + Xcode 15+** for iOS Simulator/device builds. Android is also supported.

```bash
cd ios-app
npm install
cp .env.example .env
# Edit .env with your Supabase URL + anon key
```

`.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOURPROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## Run

### Quickest: Expo Go (no native build, no Xcode needed for first try)
```bash
npx expo start
```
Press `i` to open iOS Simulator, or scan the QR code with the **Expo Go** iOS app on a physical device.

> ⚠️ Note: `react-native-maps` and `expo-image-picker` work in Expo Go, but for production-grade behavior and Apple Maps satellite tiles, use a development build below.

### Production-grade: Development build
```bash
npx expo prebuild --platform ios --clean
npx expo run:ios            # builds and launches on iOS Simulator
# or
npx expo run:ios --device   # on a connected physical device
```

This generates a native `ios/` Xcode project, builds it, and installs the dev client.

## Architecture notes

- **Auth:** email OTP via Supabase (`signInWithOtp` + `verifyOtp`). No magic-link redirect — 6-digit code works across any device.
- **Maps:** `react-native-maps` with **default provider** → Apple Maps on iOS (`mutedStandard` style for a clean light look). No API keys needed for Apple Maps.
- **Realtime:** subscribes to `outages`, `wait_checkins`, and `safety_pins` Postgres changes — same Supabase publication used by the web app.
- **Storage:** `safety-photos` bucket from the same Supabase project. Files uploaded with `user.id/<ts>.<ext>` path so RLS isolates them.
- **i18n:** auto-detects device language (AZ if anything other than `en`). Toggle in the header.
- **Mock fallback:** if `EXPO_PUBLIC_SUPABASE_URL` is missing/placeholder, every fetch returns realistic Nərimanov mock data so the UI is demo-able offline.

## Supabase setup

This app expects the same schema as the web app — see [`../supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) and [`../supabase/seed.sql`](../supabase/seed.sql).

For OTP email codes to deliver to your test device:
- **Supabase dashboard → Authentication → Email Templates → Magic Link** — leave the `{{ .Token }}` value present (the default template includes it).
- Default Supabase SMTP works for ~30 messages/hour. Configure your own SMTP for production volume.

## Bundle ID

`com.narpulse.app` (declared in `app.json`). Change before publishing to the App Store.

## Privacy strings

Pre-filled Azerbaijani strings for:
- `NSLocationWhenInUseUsageDescription`
- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`

## What's intentionally NOT in the iOS app

- **Admin dashboard** — desktop-first feature, lives in the web app only.
- **Landing page** — the iOS app opens straight into the outages tab.
- **MapLibre / OSM raster tiles** — using native Apple Maps for performance and clean UX.

## License

MIT — same as the parent project.
