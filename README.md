# NarPulse — Rayonun nəbzi

A civic-tech web app for the **Nərimanov** district of Baku. Residents see real-time outages, queue wait times, and unsafe spots; district admins see aggregated insights and resolve issues. Built for the **Openwave 2026** 48-hour hackathon (İRİA × Nərimanov RİH × Tedspace).

![Stack: Next.js · Supabase · MapLibre · Tailwind · next-intl](https://img.shields.io/badge/stack-Next.js%20·%20Supabase%20·%20MapLibre%20·%20Tailwind%20·%20next--intl-c8102e)

## Features

- 🗺️ **Real-time outage map** (`/kesintiler`) — water, electricity, gas. Pulsing markers, utility filter chips, Realtime inserts via Supabase, popups with ETA.
- ⏱️ **Wait-time reports** (`/novbeler`) — ASAN, polyclinics, post offices, banks. Residents submit a 0–120 min slider; the list shows the median of the last 60 min.
- ⚠️ **Safety pins** (`/tehlukesizlik`) — drop a pin on the map, choose a category, attach a photo, upvote others. Photos in Supabase Storage.
- 📊 **Admin dashboard** (`/admin`) — stat cards, outages table with mark-resolved, pin review queue, Recharts insights (outages over time, pins by category, average wait by location).
- 🇦🇿 / 🇬🇧 **AZ + EN** via next-intl. Azerbaijani is the default — no auto-translated strings.
- 🔐 Magic-link auth via Supabase. RİH admin role enforced by RLS.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Server Components, Turbopack)
- [Supabase](https://supabase.com) — Postgres, Auth (OTP), Realtime, Storage
- [MapLibre GL JS](https://maplibre.org) on OpenStreetMap + CARTO dark raster tiles (no API key)
- [Tailwind CSS v4](https://tailwindcss.com) with brand tokens via `@theme`
- [next-intl](https://next-intl.dev) for AZ (default) + EN
- [Recharts](https://recharts.org) for admin insights
- [Framer Motion](https://www.framer.com/motion/), [Lucide](https://lucide.dev), [Zod](https://zod.dev), [date-fns](https://date-fns.org)

> Note: the original brief asked for Next.js 15 + Tailwind v3. The live `create-next-app@latest` ships Next.js 16 + Tailwind v4 — both fully App-Router compatible. Brand tokens live in `src/app/globals.css` via Tailwind v4's `@theme` block instead of `tailwind.config.ts`.

## One-command setup

```bash
git clone <repo> narpulse && cd narpulse
npm install
cp .env.local.example .env.local   # fill in Supabase keys
npm run dev
```

Open <http://localhost:3000>.

> **No Supabase yet?** The app still runs. Every data fetch falls back to realistic Nərimanov-specific mock data (`src/lib/mock.ts`) so you can see every page before connecting a database. The README is honest about this — the demo banner on `/admin` says "Demo məlumat" so you can see at a glance which mode you're in.

## Connecting Supabase (for the live demo)

1. Create a Supabase project at <https://supabase.com>.
2. Copy your credentials into `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOURPROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # optional, server-only ops
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
3. In the Supabase SQL editor, run:
   - `supabase/migrations/0001_init.sql` — schema, RLS, storage bucket, realtime publication
   - `supabase/seed.sql` — six outages, eight service locations, 30 wait check-ins, twelve safety pins, all Nərimanov-real
4. Sign in once via `/giris` with the email you want to use for admin (`admin@narpulse.az` recommended), then in the SQL editor run:
   ```sql
   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'admin@narpulse.az');
   ```
   (or `supabase/admin.sql` — same query, ready to paste).
5. Restart `npm run dev`. The app will switch from mock data to live data automatically.

## Project structure

```
src/
├── app/
│   ├── layout.tsx               # passthrough root
│   ├── [locale]/
│   │   ├── layout.tsx           # html/body, font, NextIntlClientProvider
│   │   ├── page.tsx             # /  — landing with live stats
│   │   ├── kesintiler/page.tsx  # outages map
│   │   ├── novbeler/page.tsx    # wait times
│   │   ├── tehlukesizlik/page.tsx
│   │   ├── admin/page.tsx       # admin role-gated
│   │   ├── giris/page.tsx       # magic-link login
│   │   ├── haqqinda/page.tsx    # about
│   │   └── not-found.tsx
│   └── auth/callback/route.ts   # OTP exchange
├── components/
│   ├── brand/Logo.tsx
│   ├── layout/{Header,Footer,LocaleSwitcher}.tsx
│   ├── ui/{Button,Card,Dialog,Input,Textarea,Badge,Tabs,Toast}.tsx
│   ├── map/BaseMap.tsx
│   ├── outages/{OutagesView,utility}.tsx
│   ├── queues/QueuesView.tsx
│   ├── safety/SafetyView.tsx
│   ├── admin/{AdminDashboard,StatCard}.tsx
│   ├── auth/LoginForm.tsx
│   └── landing/LandingPage.tsx
├── i18n/{routing,request,navigation}.ts
├── lib/
│   ├── data.ts                  # server fetchers w/ fallback
│   ├── mock.ts                  # Nərimanov-real seed (TS mirror of seed.sql)
│   ├── format.ts                # date-fns AZ relative time
│   ├── utils.ts                 # cn(), map bounds
│   └── supabase/{client,server,middleware,types}.ts
└── middleware.ts                # next-intl + Supabase session
messages/{az.json, en.json}
supabase/{migrations/0001_init.sql, seed.sql, admin.sql}
```

## Realtime

The outages, wait check-ins, and safety-pins tables are added to the `supabase_realtime` publication in `0001_init.sql`. The three corresponding views subscribe via `supabase-js` and update without a refresh. To confirm: insert an outage in the SQL editor — it appears in `/kesintiler` instantly, with a top-right toast.

```sql
insert into public.outages (utility, status, area_name, center_lat, center_lng, radius_m, description)
values ('water', 'active', 'Test küç.', 40.408, 49.862, 300, 'Test event for the demo.');
```

## Deploy on Vercel

```bash
vercel --prod
```

Add the same env vars to Vercel project settings. Configure Supabase to redirect to your production URL after magic link (`SITE_URL` + `Additional redirect URLs` in Supabase Auth settings).

## Honest mocks

Everything that looks like Nərimanov on the screen *is* Nərimanov: real street names (8 Noyabr, Ağa Nemətulla, Ziya Bünyadov, Atatürk pr.), real institutions (ASAN №1, 1 saylı Şəhər Poliklinikası, Nərimanov RİH), coordinates inside the district. None of the data is real-time from Azərsu/Azərişıq/SOCAR yet — the schema and source field are ready for ingestion, but for the hackathon every row is seeded. The "Demo məlumat" badge on `/admin` is intentional so judges aren't misled.

## What's intentionally NOT in scope

- Push notifications (the toasts only fire while the page is open).
- Native mobile apps. Mobile-first responsive web only.
- Real Azərsu/Azərişıq/SOCAR ingestion pipelines — the schema is ready, the workers are not.

## Credits

Built for **Openwave 2026** — partners İRİA, Nərimanov RİH, Tedspace. Tagline *Rayonun nəbzi* — the district's pulse.

License: MIT.
