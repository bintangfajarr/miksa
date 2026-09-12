# Miksa

An English tutor that speaks Indonesian back.

A mobile app for Indonesian learners at B1: you chat in whatever mixture of
Indonesian and English comes out, and it corrects the English, explains in
the language you actually think in, and remembers every rule you got wrong.

## Status

🚧 Early development — design phase complete, implementation starting.

## Stack

- **Client:** Expo / React Native (TypeScript)
- **Backend:** Supabase (Postgres, Auth, Edge Functions, RLS)
- **AI:** LLM via OpenRouter (model TBD — evaluating structured output + prompt caching support)

## Core idea

The real asset isn't the chat — it's the error history. A per-user record of
which grammar rules this specific person breaks, how often, and whether
they're getting better. Everything else exists to populate and exploit that
data.

## v1 scope

1. Mixed-language chat + correction
2. Grammar collection (per-rule error tracking)
3. Vocab of the day

Voice, OCR, placement tests, and multi-user accounts are deferred to v2/v3.

## Security

The AI provider API key never ships to the client. It lives only in a
Supabase Edge Function secret, with a per-user rate limit and spend cap.

## Development

Coming soon.
