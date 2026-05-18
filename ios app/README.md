# NarPulse iOS

Native SwiftUI resident app for the NarPulse demo. It follows `pulse.html`: iOS 17+, resident-only, dark NarPulse branding, MapKit maps, Azerbaijani-first UI, and the same Supabase tables used by the website.

## What is included

- `NarPulseApp.swift` - complete SwiftUI app source with home, outages, wait times, safety pins, account, onboarding, MapKit annotations, mock fallback data, and Supabase REST reads.
- `Config.xcconfig` - build settings placeholders for Supabase URL and anon key.
- `Info.plist` - Supabase config expansion and Azerbaijani privacy strings.
- `pulse.html` - original build brief.

## Run in Xcode

1. Create a new iOS App project in this folder or add these files to an existing iOS 17+ SwiftUI target named `NarPulse`.
2. Add `NarPulseApp.swift` to the app target.
3. Set the target Info.plist to `Info.plist` or copy its keys into the generated target plist.
4. Assign `Config.xcconfig` to Debug and Release build configurations.
5. Copy values from the website `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` -> `SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> `SUPABASE_ANON_KEY`
6. Run on an iPhone or iOS 17+ simulator.

If the Supabase values are empty, the app still runs with local demo data so the UI can be reviewed immediately.

## Backend sync

The app reads the same tables as the website:

- `outages`
- `service_locations`
- `wait_checkins`
- `safety_pins`

No schema changes are required.
