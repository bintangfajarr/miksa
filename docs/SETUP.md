# Setup — M0

Getting the app running on your phone, talking to your own Supabase project.

Everything here is one-time. Steps 1–3 are yours (they need a browser and your
own account); step 4 onward is just running commands.

---

## 1. Create the Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Name it `miksa`, pick the **Southeast Asia (Singapore)** region — it is the
   closest to Indonesia and the round-trip time is noticeable on mobile
3. Save the database password somewhere; you will not be shown it again
4. Wait ~2 minutes for provisioning

## 2. Run the migration and seed

In the dashboard: **SQL Editor** → **New query**.

1. Paste the whole of [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql), run it
2. Paste the whole of [`supabase/seed.sql`](../supabase/seed.sql), run it

Verify with:

```sql
select id, cefr, title_id from grammar_rules order by cefr, id;
```

You should get 8 rows. If you get a permission error instead, you are running
as the wrong role — use the SQL Editor, not the API.

## 3. Enable anonymous sign-in

**Authentication** → **Sign In / Providers** → **Anonymous sign-ins** → enable.

The app has no accounts in v1 (SDD §2), but every install still becomes a real
row in `auth.users`. That is what makes row-level security work from day one,
and it makes adding email login later a linking operation rather than a
migration.

> Without this step the app fails at launch with
> `Anonymous sign-ins are disabled`.

## 4. Point the app at your project

**Project Settings** → **Data API**. Copy the **Project URL** and the
**anon / public** key.

```powershell
Copy-Item .env.example .env
```

Then edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> **On the anon key being public.** It is meant to be. It identifies the
> project, and RLS decides what it can actually read — which is only the rows
> belonging to the signed-in user. The key that must never be here is the
> OpenRouter key: `EXPO_PUBLIC_*` values are inlined into the bundle and can be
> extracted from a phone in minutes. That one lives in a Supabase Edge Function
> secret, arriving at M1. See SDD §3.

## 5. Run it

```powershell
npm install     # first time only
npm start
```

Install **Expo Go** from the Play Store, then scan the QR code from the
terminal. Phone and computer must be on the same Wi-Fi.

If your network blocks device-to-device traffic (common on campus Wi-Fi):

```powershell
npx expo start --tunnel
```

---

## What "done" looks like

The M0 screen shows:

- **Auth** — anonymous session aktif
- **User ID** — the first 8 characters of your uid
- **Postgres** — `8 grammar rules`

followed by the eight seeded rules, each with its Indonesian explanation and a
wrong/right example pair.

That is the milestone: *your phone displays a row that came from Postgres.*

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Missing env var EXPO_PUBLIC_SUPABASE_URL` | No `.env`, or values still placeholders | Step 4. Restart `npm start` — env vars are read at bundler start |
| `Anonymous sign-ins are disabled` | Step 3 skipped | Enable it, then restart the app |
| Postgres row says `0 grammar rules` | Seed not run | Step 2, second file |
| `relation "grammar_rules" does not exist` | Migration not run | Step 2, first file |
| QR scans but never loads | Network isolation | `npx expo start --tunnel` |
| Changes to `.env` seem ignored | Bundler caches env at startup | Stop and re-run `npm start` |
