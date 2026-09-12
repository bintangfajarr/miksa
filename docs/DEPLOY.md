# Deploying the Edge Function — M1

The chat endpoint holds the OpenRouter key and is the only place the daily
quota can be spent. It runs on Supabase, not on your phone (SDD §3).

---

## 1. Get an OpenRouter key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. **Keys** → **Create key**, name it `miksa`
3. Copy it now — it is shown once

No credit card needed. You are on the free tier: **50 requests per day, 20 per
minute**, shared across the whole account.

> **This key must never reach the phone.** Not in `.env`, not in
> `EXPO_PUBLIC_*`, not in `app.json`. Anything bundled into an APK can be
> extracted in minutes and a leaked key gets drained by bots. It goes into a
> Supabase secret and nowhere else.

## 2. Run the quota migration

Dashboard → **SQL Editor** → paste
[`supabase/migrations/0002_quota.sql`](../supabase/migrations/0002_quota.sql) → run.

This adds three functions:

| Function | Who can call it | What it does |
|---|---|---|
| `consume_chat_quota` | service role only | Atomically reserves one request, or refuses at the cap |
| `refund_chat_quota` | service role only | Returns a reservation the model never used |
| `get_chat_quota` | any signed-in user | Read-only, for the counter in the UI |

The two mutating ones are revoked from `anon` and `authenticated` on purpose: a
client that could increment or reset its own counter would make the cap
decorative.

## 3. Install the Supabase CLI

```powershell
npm install -g supabase
```

Or, if you would rather not install anything globally, prefix each command
below with `npx` instead.

## 4. Link the project

Grab your project ref from the dashboard URL —
`https://supabase.com/dashboard/project/`**`abcdefghijklmnop`** — then:

```powershell
supabase login
supabase link --project-ref abcdefghijklmnop
```

## 5. Set the secret

```powershell
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Optionally override the model without a redeploy:

```powershell
supabase secrets set MODEL=nvidia/nemotron-3-super-120b-a12b:free
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do
not set them yourself.

Verify with `supabase secrets list`. It shows names and digests, never values.

## 6. Deploy

```powershell
supabase functions deploy chat
```

Then restart the Expo bundler and send a message from the app.

---

## What "done" looks like

You type something in Indonesian — *"halo, aku lagi belajar buat UTS"* — and get
an English reply within a few seconds. The header shows the remaining quota
ticking down.

That is M1: *you type Indonesian and get an English reply.*

Corrections arrive at M2.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `server_misconfigured` | Secret not set, or set after the last deploy | `supabase secrets set …` then redeploy |
| `Server belum dikonfigurasi` in the app | Same as above | Same as above |
| `quota_check_failed` | Migration 0002 not run | Step 2 |
| `unauthorized` | Anonymous sign-in disabled, or stale session | Check Auth settings; restart the app |
| `upstream_rate_limited` | 50/day or 20/min hit | Wait. Resets at UTC midnight (07:00 WIB) |
| `upstream_failed` 502 | Model unavailable or renamed | Check the model still exists on openrouter.ai/models |
| Reply is in Indonesian | Model ignored the persona | Expected occasionally on small models — one of the things the M2 benchmark measures |

### Reading the logs

Dashboard → **Edge Functions** → `chat` → **Logs**. Upstream failures are
logged with the first 500 characters of OpenRouter's response, which is usually
enough to see what went wrong.

### The kill switch

If something loops and starts burning requests, stop it from the SQL Editor
without a deploy:

```sql
update app_config set value = 'false'::jsonb where key = 'ai_enabled';
```

Every call is refused until you set it back to `true`.

### Adjusting the cap

```sql
update app_config set value = '30'::jsonb where key = 'daily_chat_cap';
```

Default is 40, leaving ~10 of the platform's 50 for the vocab job (M4), retries,
and manual testing. See SDD §7.
