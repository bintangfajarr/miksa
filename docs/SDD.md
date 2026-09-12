# Miksa — Software Design Document

**Version:** 0.2 (draft) · **Supersedes:** v0.1 (12 September 2026)
**Status:** Design phase complete, implementation starting.

> An English tutor that explains itself in Indonesian.
>
> A mobile app for Indonesian learners at B1: you chat in whatever mixture of
> Indonesian and English comes out, and it corrects the English, explains in
> the language you actually think in, and remembers every rule you got wrong.

| | |
|---|---|
| **Platform** | Expo / React Native — **Android only** for v1 |
| **Backend** | Supabase |
| **Model** | `nvidia/nemotron-3-super-120b-a12b:free` via OpenRouter |
| **Budget** | Rp 0 — free-tier models only |
| **V1 target** | 8 weeks part-time |
| **Audience** | Personal → public |

### Changes from v0.1

| Area | v0.1 | v0.2 | Why |
|---|---|---|---|
| Name | *(undecided)* | **Miksa** | From "mix" — the code-switching premise |
| AI gateway | Anthropic direct | **OpenRouter** | Model portability; one key, many models |
| Model | `claude-opus-5` (~$20/mo) | `nemotron-3-super-120b:free` | Zero-budget constraint |
| Reply language | Ambiguous (title vs §11) | **English reply, Indonesian correction notes** | Resolves the v0.1 contradiction; maximises English input |
| Platform | Android + iOS | **Android only** | No $99/yr Apple account needed for v1 |
| Structured output | `messages.parse()` + Zod | `response_format: json_schema` | OpenRouter uses the OpenAI-compatible shape |
| Prompt caching | `cache_control` ephemeral | **Not available** | Free-tier models do not support caching |
| Rate limiting | Cost guardrail | **Availability guardrail** | 50 req/day hard platform cap — see §7 |

---

## §1 — Why this app is different

Every English app on the Play Store assumes you type in English. Real Indonesian
learners at B1 don't — they write *"aku udah coba tapi masih confused sama grammar
nya"*, and every existing app either rejects that or silently ignores half of it.

That mixing is not a failure to learn. It's **code-switching**, and it's the normal
behaviour of every bilingual speaker on earth. The product thesis is simple: treat
the mixed sentence as the unit of input. Correct the English parts, read the
Indonesian parts for intent, and — this is the valuable half — notice which ideas
the learner could only express in Indonesian. Those are exactly the words and
structures to teach next.

> ### Core thesis
> The app's real asset is not the chat. It's the **error history** — a per-user
> record of which grammar rules this specific person breaks, how often, and
> whether they're getting better. Everything else in this document exists to
> populate and exploit that table.

---

## §2 — Scope

V1 is three features. Voice and OCR are the two most technically expensive things
on the wishlist, and neither is what makes the app good — so they wait.

| Feature | Release | Why there |
|---|---|---|
| Mixed-language chat + correction | **V1** | The core loop. Everything else is decoration without it. |
| Grammar collection | **V1** | Cheap to build once corrections are structured. Highest value per line of code. |
| Vocab of the day | **V1** | One scheduled call, configurable count, example sentences. Mostly a cron problem. |
| Streak + daily goal | **V1** | One integer and a notification. An afternoon's work, best retention mechanic there is. |
| Placement test + levels | V2 | Needs calibration data to be meaningful. Faked in v1 with a self-reported level. |
| Speaking with AI | V2 | STT, TTS, audio permissions, latency budget. A project on its own. |
| Image to text | V2 | Mostly camera UX — but it's a side quest. |
| Spaced repetition of your own errors | V2 | The feature that would make this app genuinely special. See §9. |
| Accounts, billing, moderation | V3 | Only if it opens to the public. |

> ### Scope discipline
> Shipping three features to your own phone in eight weeks is an excellent
> outcome; shipping seven half-working ones is the normal outcome, and it's how
> side projects die. **Resist adding to v1.**

---

## §3 — Architecture

Three tiers. The only structurally important decision: **the phone never talks to
OpenRouter directly.**

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT — Expo / React Native (TypeScript), Android          │
│                                                              │
│  Chat screen          Grammar collection    Vocab of the day │
│  bubbles, cards       list, detail, delete  count, examples  │
│                                                              │
│  Local cache — SQLite / MMKV, offline reads                  │
└─────────────────────────────────────────────────────────────┘
                  ↓  HTTPS + Supabase JWT
┌─────────────────────────────────────────────────────────────┐
│  SERVER — Supabase (the trust boundary)                      │
│                                                              │
│  Edge Functions       Postgres + RLS      Auth      pg_cron  │
│  Deno; holds the key  chats, corrections  anon →    daily    │
│                       rules, vocab        email     vocab    │
└─────────────────────────────────────────────────────────────┘
                  ↓  server-to-server, key never leaves
┌─────────────────────────────────────────────────────────────┐
│  EXTERNAL                                                    │
│  OpenRouter API  ·  Expo EAS (builds + OTA updates)          │
└─────────────────────────────────────────────────────────────┘
```

> ### Security — the one mistake that costs real money
> **Never put the OpenRouter API key in the Expo app.** Not in `app.json`, not in
> `EXPO_PUBLIC_*`, not in a `.env` the bundler inlines. Anything shipped to a
> phone can be extracted from the bundle in minutes, and a leaked key gets
> drained by bots.
>
> The key lives in a Supabase Edge Function secret and nowhere else. Add a
> per-user rate limit and a kill switch in the same function on day one, before
> you ever share a build.

---

## §4 — Stack, and why

| Layer | Choice | Rationale |
|---|---|---|
| App framework | **Expo (React Native)** | One TypeScript codebase. Expo Go runs it on your phone in minutes with no Android Studio. EAS Update ships fixes without a store review. |
| Language | **TypeScript** | Same language client and server, so correction types are shared, not duplicated. |
| Backend | **Supabase** | Postgres, auth, RLS, cron, and Deno Edge Functions in one free project. Adding real accounts later is a config change, not a rewrite. |
| AI gateway | **OpenRouter** | One key, one endpoint, many models. Swapping models later is an env var, not an integration. |
| Model (chat) | **`nvidia/nemotron-3-super-120b-a12b:free`** | 120B params — the largest free model that supports structured outputs. Zero cost. |
| Model (vocab) | Same | No reason to introduce a second model while both are free. |
| State | **TanStack Query + Zustand** | Server state and UI state are different problems; keep them in different tools. |
| Delivery | **EAS Build** | Cloud builds, no local Android toolchain. APK → Play Store internal testing when ready. |

### On OpenRouter specifically

Three things changed versus talking to Anthropic directly:

1. **Structured output uses the OpenAI-compatible shape** —
   `response_format: { type: "json_schema", strict: true }` instead of
   Anthropic's `messages.parse()` helper. Same concept, different call.

2. **Support is per-endpoint, not per-model.** The same model may be served by
   several providers and only some support structured outputs. You **must** set
   `require_parameters: true` in provider preferences, or a request can silently
   route to an endpoint that ignores your schema.

3. **No prompt caching on free models.** The `cache_control` optimisation from
   v0.1 does not apply. Cost is unaffected (free is free), but it means the
   system prompt must stay lean for latency reasons, not billing reasons.

---

## §5 — Data model

Five tables. The interesting one is `grammar_rules`, and the reason is in §6.

```sql
-- supabase/migrations/0001_init.sql

-- Every learner. Starts as an anonymous Supabase user.
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  cefr_level    text    not null default 'B1',   -- A1..C2
  native_lang   text    not null default 'id',
  vocab_per_day int     not null default 5,
  explain_in    text    not null default 'id',   -- 'id' | 'en' | 'mix'
  streak_days   int     not null default 0,
  created_at    timestamptz not null default now()
);

-- One row per chat turn, user and assistant alike.
create table messages (
  id         bigserial primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  lang_mix   jsonb,        -- {"id": 0.6, "en": 0.4} — collected for the v2 level signal
  created_at timestamptz not null default now()
);
create index on messages (user_id, created_at desc);

-- The canonical catalogue of grammar points. SEEDED BY HAND, not by the model.
-- ~60 rows covering A2..B2. This is what stops the collection filling with duplicates.
create table grammar_rules (
  id             text primary key,   -- 'article-indefinite', 'question-embedded'
  title_en       text not null,
  title_id       text not null,
  cefr           text not null,
  explanation_id text not null,      -- the canonical Indonesian explanation
  example_wrong  text not null,
  example_right  text not null
);

-- One row per correction the model made. The product's real asset.
create table corrections (
  id          bigserial primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  message_id  bigint references messages(id) on delete set null,
  rule_id     text   references grammar_rules(id),  -- null = uncatalogued
  original    text not null,
  corrected   text not null,
  note        text,                                 -- model's one-line reason, in Indonesian
  dismissed   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on corrections (user_id, rule_id);

-- Words served on a given day, with the sentence they were taught in.
create table vocab_items (
  id         bigserial primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  word       text not null,
  meaning_id text not null,   -- meaning in Indonesian
  example_en text not null,
  served_on  date not null default current_date,
  saved      boolean not null default false,
  unique (user_id, word)
);

-- Daily quota tracking. Not optional — see §7 on the 50 req/day platform cap.
create table usage_daily (
  user_id     uuid not null references profiles(id) on delete cascade,
  day         date not null default current_date,
  chat_calls  int  not null default 0,
  vocab_calls int  not null default 0,
  primary key (user_id, day)
);

-- Global kill switch and config, read by the Edge Function before every call.
create table app_config (
  key   text primary key,
  value jsonb not null
);
-- seed: ('ai_enabled', 'true'), ('daily_chat_cap', '40'), ('model', '"nvidia/..."')
```

### Row-level security

```sql
alter table profiles    enable row level security;
alter table messages    enable row level security;
alter table corrections enable row level security;
alter table vocab_items enable row level security;
alter table usage_daily enable row level security;

-- NOTE: profiles keys on `id`, every other table keys on `user_id`.
create policy "own row"  on profiles
  for all using (auth.uid() = id)      with check (auth.uid() = id);

create policy "own rows" on messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on corrections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on vocab_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on usage_daily
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- grammar_rules and app_config are public-read, service-role-write.
-- They hold no user data.
```

> ### Do this on day one
> Enable RLS on every user table **before** writing any client code. Adding RLS
> to a working app is a painful retrofit; starting with it costs nothing.

---

## §6 — The AI layer

This is where the app is won or lost. Three design decisions matter far more than
the rest of the code.

### 6.1 — A fixed rule taxonomy, not free-form labels

The obvious implementation asks the model to name the grammar rule it corrected.
Do that and within a week the collection holds *"Article usage"*, *"Articles
(a/an)"*, *"Missing article"* and *"Indefinite articles"* as four separate
entries — the same rule, unlinkable, uncountable, useless for tracking progress.

Instead, seed `grammar_rules` with a fixed catalogue of ~60 IDs and make the
model classify into it with a constrained enum. Now *"how often do I break this
rule"* is a `group by rule_id`, and every downstream feature — progress charts,
spaced repetition, level-up tests — becomes a simple query.

| `rule_id` | CEFR | What it catches |
|---|---|---|
| `article-indefinite` | A2 | *I need roadmap* → *I need **a** roadmap* |
| `question-embedded` | B1 | *you know what should I do* → *what **I should** do* |
| `tense-present-perfect` | B1 | *I already eat* → *I've already eaten* |
| `agreement-third-person-s` | A2 | *he go* → *he goes* |
| `punct-comma-splice` | B1 | two sentences joined by a comma |
| `prep-collocation` | B1 | *discuss about* → *discuss* |
| `conditional-third` | B2 | *if I knew, I would tell* → *had known … would have told* |
| `word-order-adverb` | B1 | *I go always* → *I always go* |

Allow exactly one escape hatch: `rule_id: null` with a free-text note, for
genuinely novel errors. Review those nulls monthly and promote recurring ones
into the catalogue by hand. **That's your product roadmap, written by your own
users.**

### 6.2 — Structured output, not parsed prose

Ask for prose and you'll write a regex to find the corrections inside it, and
that regex will break. Constrain the response shape with a JSON schema instead.

```ts
// supabase/functions/chat/index.ts
import OpenAI from "npm:openai";
import { z } from "npm:zod";
import { zodToJsonSchema } from "npm:zod-to-json-schema";

// The key is read from a Supabase secret — it never reaches the phone.
const client = new OpenAI({
  apiKey:  Deno.env.get("OPENROUTER_API_KEY")!,
  baseURL: "https://openrouter.ai/api/v1",
});

// RULE_IDS is loaded once from grammar_rules and frozen into the enum.
const Turn = z.object({
  reply: z.string()
    .describe("Your conversational reply, in ENGLISH, B1-friendly."),
  lang_mix: z.object({ id: z.number(), en: z.number() }),
  corrections: z.array(z.object({
    original:  z.string(),
    corrected: z.string(),
    rule_id:   z.enum(RULE_IDS).nullable(),
    note:      z.string()
      .describe("One line, in INDONESIAN, explaining why it was wrong."),
  })).max(3),
  vocab_gaps: z.array(z.string())
    .describe("Ideas the user could only express in Indonesian."),
});

const res = await client.chat.completions.create({
  model: Deno.env.get("MODEL") ?? "nvidia/nemotron-3-super-120b-a12b:free",
  max_tokens: 1500,
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    ...recentHistory,                      // last ~10 turns only
    { role: "user", content: userText },
  ],
  response_format: {
    type: "json_schema",
    json_schema: { name: "turn", strict: true, schema: zodToJsonSchema(Turn) },
  },
  // CRITICAL: without this, the request can route to an endpoint that
  // ignores response_format entirely and returns unparseable prose.
  // @ts-expect-error — OpenRouter extension to the OpenAI schema
  provider: { require_parameters: true },
});

const parsed = Turn.safeParse(JSON.parse(res.choices[0].message.content!));
if (!parsed.success) { /* fall back to reply-only, log, do not persist */ }
```

Two things that differ from a paid-model design:

- **No `cache_control`.** Free models don't cache. Keep `SYSTEM_PROMPT` lean —
  every token is re-sent on every turn and paid for in latency.
- **Always validate.** A smaller model is likelier to produce schema-shaped but
  semantically wrong output. `safeParse` is not optional, and a failed parse must
  degrade gracefully to a plain reply rather than 500 the request.

### 6.3 — Correct like a good teacher, not a spell-checker

A model left unprompted will correct every deviation in every message. That is
demoralising, and it's why learners quit. Encode the teaching policy explicitly:

1. **Cap it.** At most **three** corrections per turn, most important first.
   Silently drop the rest.
2. **Never correct Indonesian.** Code-switching is allowed and expected — it's
   the premise of the product.
3. **Reply in English, explain in Indonesian.** The conversational reply is
   always English (that's the learner's input exposure). Correction notes are
   Indonesian at B1, shifting toward English as the learner approaches B2 — the
   `explain_in` column.
4. **Always answer the human first.** The reply comes before the corrections and
   responds to what they *meant*. A conversation that stops to grade you isn't a
   conversation.
5. **Praise the repaired error.** When a rule they've broken before is used
   correctly, say so. That's the only feedback loop that produces motivation.

---

## §7 — Cost and limits

**Direct model cost: Rp 0.** The constraint on this project is not money — it is
**request quota**, and that is a harder constraint to design around.

### The platform cap

| Credits purchased (all time) | Requests / minute | Requests / day |
|---|---|---|
| **< $10 — our situation** | 20 | **50** |
| ≥ $10 (one-off, models stay free) | 20 | 1,000 |

**50 requests per day is the entire budget**, shared between chat and the vocab
job. Exceeding it returns HTTP 429 and the app stops working until UTC midnight.

### Budget allocation

| Consumer | Calls/day | Note |
|---|---|---|
| Vocab of the day | 1 | One batched call generating N words |
| Weekly report (V2) | ~0.15 | One call per week |
| **Chat — usable budget** | **~40** | Hard cap in `app_config.daily_chat_cap` |
| Safety margin | ~9 | Retries, failed parses, manual testing |

This changes the meaning of the per-user cap from v0.1. It is no longer a
cost guardrail — **it is an availability guardrail**. Without it, a single
enthusiastic session at 10am leaves the app dead for the rest of the day, with a
raw 429 as the only explanation.

### Required design consequences

1. **Enforce the cap server-side** in `usage_daily` *before* calling OpenRouter,
   and return a structured "quota exhausted" response the UI can render kindly —
   *"Jatah chat hari ini habis, balik lagi besok ya"* — never a raw 429.
2. **Show remaining quota in the UI.** The user is you; you need to know you have
   6 turns left before you start a long conversation.
3. **Failed parses still burn quota.** Every retry is a request. Cap retries at 1.
4. **Batch the vocab job.** Generate all N words in one call, never N calls.
5. **Exponential backoff on 429**, honouring `Retry-After`.

### The escape hatch, documented for later

A **one-off $10 deposit** (~Rp 160,000, not a subscription) raises the daily cap
from 50 to 1,000 while the models remain free. If the 50/day ceiling proves to be
the thing that stops you using the app daily, that is the cheapest fix available —
20× the capacity for a single payment. Revisit at M6 with real usage data.

---

## §8 — Build plan

Eight milestones, roughly a week each part-time. Each ends with something you can
open on your phone — never spend a week on work you can't see.

| # | Milestone | Done when |
|---|---|---|
| **M0** | **Skeleton** — Expo app on your phone via Expo Go. Supabase project, anonymous auth, one table, one query rendered. | Your phone displays a row that came from Postgres. |
| **M1** | **Proxy + first reply** — Edge Function holding the key, calling OpenRouter, returning text. Chat screen with message list and input. No corrections yet. | You type Indonesian and get an English reply. |
| **M2** | **Structured corrections** — JSON schema, `require_parameters`, validation, corrections persisted. Correction cards, expandable to the Indonesian explanation. **Benchmark the model here** (see below). | A wrong sentence produces a card that explains itself. |
| **M3** | **Rule catalogue + collection** — Seed ~60 rules. Classify into them. Collection screen grouped by rule, sorted by frequency, swipe to remove. | You can see your own top three errors ranked. |
| **M4** | **Vocab of the day** — `pg_cron` job generating N words each morning from level + `vocab_gaps`. Count picker. Save-to-collection. | Words appear each morning without opening the app. |
| **M5** | **Streaming + polish** — Streaming replies, empty states, error states, offline reads, loading skeletons, quota indicator. | It feels like a real app, not a demo. |
| **M6** | **Guardrails** — Daily cap enforcement, kill switch, quota UI, backoff, analytics on turns/day. Fix the three worst prompt failures found so far. | You'd be comfortable giving a friend the link. |
| **M7** | **Ship it** — EAS Build → APK on your phone, then Play Store internal testing. Privacy policy if public. Then use it daily for two weeks before building anything new. | It's installed, and you've used it seven days running. |

> ### The M2 benchmark — do not skip this
> The free model's correction quality is **unvalidated** for this specific task:
> English correction + Indonesian explanation + classification into 60 rule IDs.
>
> At M2, hand-write ~30 sentences with errors you already know the answer to.
> Run them through. Measure: (a) was the correction right, (b) was the `rule_id`
> right, (c) was the Indonesian note comprehensible. If `rule_id` accuracy is
> above ~80%, ship it and never think about this again. If it's below, you have
> data to decide with instead of a guess.
>
> **This is why the model ID lives in an env var.** Swapping it must stay a
> one-line change through the entire build.

---

## §9 — Features worth adding

Ranked by value per unit of work.

| Feature | Release | Why |
|---|---|---|
| **Errors that come back to find you** | V2 | Three days after you break `question-embedded`, the tutor steers the conversation somewhere you must produce that structure — and sees whether you get it right this time. Not a flashcard: a **trap, inside a real conversation**. No other app can do this, because no other app has your error history. This is the feature the whole data model was designed for. |
| **Weekly report card** | V2 | Errors per 100 words, trending. Rules that improved, rules that didn't, one sentence on what to focus on. One query and one API call per week. |
| **Scenario mode** | V2 | Pick a situation — job interview, ordering food, presenting your thesis. Same engine, different system prompt. Nearly free, and it fixes the "what do I even talk about" problem that kills daily use. |
| **Streak and a daily goal** | **V1** | One integer in `profiles` and a notification. Boring, slightly manipulative, and the single most effective retention mechanic ever built. |
| **Export vocabulary to Anki** | V3 | CSV export of saved words with example sentences. Trivial, and it means the app plays well with the SRS tool serious learners already use. |
| **Shareable correction cards** | V3 | Render a correction as an image sized for an Instagram story. Free marketing, if it ever goes public. |
| **Camera → text → explain** | V2 | Point the camera at a textbook page, get hard words explained in Indonesian and saved to vocab. Needs a vision-capable model — check free-tier availability first. |

---

## §10 — Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Free model's correction quality is inadequate** | **High** | The M2 benchmark, run before building anything on top. Model ID in an env var so switching is one line. A wrong correction teaches a wrong rule — this is the project's central quality risk. |
| **50 req/day cap makes the app unusable** | **High** | Server-side cap at 40, batched vocab job, quota visible in UI, kind exhaustion message. Escape hatch: one-off $10 deposit → 1,000/day. |
| Leaked API key drains the account | High | Key only in the Edge Function. Kill switch. Rotate if a build ever shipped with it. |
| Request routed to an endpoint ignoring the schema | Medium | `provider: { require_parameters: true }` on every call. `safeParse` with graceful degradation. |
| Over-correction makes the app unpleasant | Medium | Three-correction cap, praise repairs. Test on yourself daily from M2. |
| Rule catalogue doesn't fit real errors | Medium | The `rule_id: null` escape hatch. Review monthly, promote recurring cases. |
| Free model deprecated without notice | Medium | Free models come and go. Env-var model ID plus an OpenRouter fallback model list. |
| Scope creep kills the project | High | §2 exists. Voice and OCR do not enter v1 under any circumstances. |
| You stop using it after two weeks | Medium | Streak, notification, scenario mode. You're the target user — if you won't use it, learn why early. |

### Privacy note

Free-tier models generally permit the provider to train on submitted data. Fine
for a personal project; it **must** be disclosed in the privacy policy if the app
ever opens to the public (M7 / V3).

---

## §11 — Resolved decisions

| Question | Decision |
|---|---|
| Campus assignment? | **No** — personal project. No formal SRS/UML required. |
| Android or iOS? | **Android only** for v1. No Apple developer account needed. |
| AI budget? | **Rp 0** — free-tier models only. Revisit the $10 quota deposit at M6. |
| Reply language? | **English reply, Indonesian correction notes.** Resolves the v0.1 title/§11 contradiction. |
| Name? | **Miksa** — from "mix", the code-switching premise. |

### Still open

1. **Which free model wins the M2 benchmark?** Starting with
   `nvidia/nemotron-3-super-120b-a12b:free`. Alternatives to test:
   `nex-agi/nex-n2.5-pro:free`, `dots-studio/dots-3-note-preview:free`.
2. **Does the 50/day cap survive contact with real use?** Measure at M6.
3. **Is a vision-capable free model available** for the V2 camera feature?

---

*Draft v0.2 · Model availability and rate limits verified against the OpenRouter
API on 12 September 2026. Free-tier model availability changes frequently —
re-verify before relying on it. Rupiah conversions assume ~Rp 16,000 to the dollar.*
