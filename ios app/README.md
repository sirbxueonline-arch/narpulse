# NarPulse iOS — SwiftUI

Native SwiftUI resident app for NarPulse. iOS 17+, dark brand theme, MapKit, Azerbaijani-first UI, same Supabase tables as the web app.

> If you'd rather use a cross-platform RN/Expo build, see [`../ios-app/`](../ios-app/).

## Project layout

```
ios app/
├── NarPulse.xcodeproj/                   ← Xcode project (open this)
│   ├── project.pbxproj
│   └── xcshareddata/xcschemes/NarPulse.xcscheme
├── NarPulse/                              ← target source group
│   ├── NarPulseApp.swift                  ← entire app in one file
│   ├── Info.plist                         ← bundle keys + permissions + $(SUPABASE_*) refs
│   ├── Config.xcconfig                    ← bundle id, deployment target, Supabase env
│   ├── Assets.xcassets/                   ← AppIcon + AccentColor
│   ├── az.lproj/Localizable.strings       ← Azerbaijani
│   └── en.lproj/Localizable.strings       ← English
├── pulse.html                             ← original build brief, not bundled
├── .gitignore
└── README.md
```

## Build & run

### From the command line (no Xcode UI)

```bash
cd "ios app"

# Build for the iOS Simulator (any arch)
xcodebuild \
  -project NarPulse.xcodeproj \
  -scheme NarPulse \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ./build \
  CODE_SIGNING_ALLOWED=NO \
  build
```

The `.app` lands in `./build/Build/Products/Debug-iphonesimulator/NarPulse.app`.

### In Xcode

```bash
open "ios app/NarPulse.xcodeproj"
```

Select the **NarPulse** scheme, pick a simulator destination, hit ▶️ Run. The first launch shows the onboarding screens, then drops you into the four-tab UI.

### On a physical device

The `Config.xcconfig` sets `PRODUCT_BUNDLE_IDENTIFIER = io.narpulse.ios`. Change it to something unique under your team, set your team in **Signing & Capabilities**, then Run.

## Configure Supabase

Open `NarPulse/Config.xcconfig`:

```
SUPABASE_URL = https://YOURPROJECT.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOi...
```

Note: xcconfig values **don't quote**, don't include `//` in URLs without escaping (Xcode treats `//` as a comment unless you write `https:/$()/...` — the simplest workaround is to keep the URL on a `$(()` boundary or just use Xcode's build settings UI).

These get substituted into `Info.plist` at build time. The Swift source reads them via `Bundle.main.infoDictionary` at startup.

**If Supabase is empty**, the app boots into demo mode with full Nərimanov mock data so the UI is reviewable instantly.

## Schema

Same tables as the web app (see `../supabase/migrations/0001_init.sql`):

| Table | Used for |
|---|---|
| `outages` | Live outage map + list |
| `service_locations` | Queue markers |
| `wait_checkins` | Median wait calculation |
| `safety_pins` | Safety pin map + upvotes |

No iOS-specific migrations.

## Permissions (Info.plist)

- `NSLocationWhenInUseUsageDescription` — to show "you are here" on the map
- `NSCameraUsageDescription` — to attach a photo to a safety pin
- `NSPhotoLibraryUsageDescription` — to pick an existing photo

All strings are in Azerbaijani per district guidance.

## Frameworks

Built-in only: **SwiftUI · MapKit · Observation · Foundation · UIKit**. No SwiftPM dependencies, no CocoaPods. `xcodebuild` works out of the box.
