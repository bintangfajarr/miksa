# Miksa

An English tutor that explains itself in Indonesian.

A mobile app for Indonesian learners at B1: you chat in whatever mixture of
Indonesian and English comes out, and it corrects the English, explains in
the language you actually think in, and remembers every rule you got wrong.

The name comes from *mix* — code-switching is the premise, not a bug.

## Status

🚧 Early development — design phase complete, implementation starting.

See [`docs/SDD.md`](docs/SDD.md) for the full software design document.

## Stack

- **Client:** Expo / React Native (TypeScript) — Android only for v1
- **Backend:** Supabase (Postgres, Auth, Edge Functions, RLS, pg_cron)
- **AI:** `nvidia/nemotron-3-super-120b-a12b:free` via OpenRouter
- **Budget:** Rp 0 — free-tier models only

## Core idea

The real asset isn't the chat — it's the **error history**. A per-user record of
which grammar rules this specific person breaks, how often, and whether they're
getting better. Everything else exists to populate and exploit that data.

## How it behaves

- Replies in **English** (that's the input exposure you're here for)
- Explains corrections in **Indonesian** (that's the language you think in)
- Never corrects your Indonesian — mixing is expected
- At most 3 corrections per turn, most important first
- Classifies every error into a fixed catalogue of ~60 grammar rules

## v1 scope

1. Mixed-language chat + correction
2. Grammar collection (per-rule error tracking)
3. Vocab of the day
4. Streak + daily goal

Voice, OCR, placement tests, spaced repetition, and multi-user accounts are
deferred to v2/v3.

## Two constraints that shape the design

**The API key never ships to the client.** It lives only in a Supabase Edge
Function secret, behind a per-user rate limit and a kill switch.

**50 requests per day.** That's the OpenRouter free-tier platform cap, shared
between chat and the daily vocab job. The per-user cap isn't a cost guardrail
here — it's an availability guardrail. See §7 of the SDD.

## Development

```powershell
npm install
Copy-Item .env.example .env   # then fill in your Supabase values
npm start                     # scan the QR code with Expo Go
```

Full first-time setup — including the Supabase project, migration, and
anonymous sign-in — is in [`docs/SETUP.md`](docs/SETUP.md). Deploying the chat
endpoint is in [`docs/DEPLOY.md`](docs/DEPLOY.md).

### Layout

```
App.tsx                        entry point, tab shell, cache hydration
src/
  components/                  CorrectionCard, TabBar
  hooks/                       useSession, useChat, useProfile
  lib/                         supabase client, api, env, storage, persist
  screens/                     Chat, Collection, Profile
  types/database.ts            hand-written until the schema settles
supabase/
  migrations/0001_init.sql     schema + RLS
  migrations/0002_quota.sql    atomic quota reservation + kill switch
  migrations/0003_streak.sql   streak tracking, computed in Asia/Jakarta
  functions/chat/              the Edge Function that holds the API key
  functions/_shared/prompt.ts  persona, JSON schema, output validation
  seed.sql                     67-rule grammar catalogue
bench/
  fixtures.json                40 scored test cases
  run.mjs                      model benchmark (SDD §8 gate)
docs/
  SDD.md                       software design document
  SETUP.md                     first-time setup
  DEPLOY.md                    Edge Function deployment
```

### Progress

- [x] **M0** — Skeleton: Expo app, anonymous auth, one query rendered
- [x] **M1** — Proxy + first reply
- [x] **M2** — Structured corrections + benchmark harness
- [ ] **M3** — Collection screen — *blocked on the benchmark below*
- [ ] **M4** — Vocab of the day
- [~] **M5** — Partial: tabs, streak, offline cache, profile settings
- [ ] **M6** — Guardrails
- [ ] **M7** — Ship it

See §8 of the SDD for what each milestone means.

### Next step: run the benchmark

M3 ranks your errors by `rule_id`, so its value depends entirely on those ids
being accurate — and that is unverified. Before building on it:

```powershell
$env:OPENROUTER_API_KEY = "sk-or-v1-..."
node bench/run.mjs --limit 10 --verbose
```

No Supabase or phone needed, just a free API key. It prints PASS or FAIL
against the 80% bar in SDD §8. If it fails, switch models with
`supabase secrets set MODEL=...` — no redeploy. See [`bench/`](bench/README.md).
