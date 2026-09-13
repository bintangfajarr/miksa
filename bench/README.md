# Model benchmark

Answers one question: **is the free model good enough to build the collection
screen on?**

The SDD calls this out as an explicit gate at M2 (§8), and as the project's
central quality risk (§10). The free model's ability to do this specific job —
English correction, plus Indonesian explanation, plus classification into 67
rule ids — is unvalidated. A wrong correction teaches a wrong rule, and a
mis-classified one poisons the error history that everything else is built on.

## Running it

```powershell
$env:OPENROUTER_API_KEY = "sk-or-v1-..."
node bench/run.mjs
```

Useful flags:

```powershell
node bench/run.mjs --verbose                        # print every reply and correction
node bench/run.mjs --limit 5                        # first 5 cases only
node bench/run.mjs --model nex-agi/nex-n2.5-pro:free
node bench/run.mjs --delay 5000                     # slower, if you hit 20/min
```

It calls OpenRouter directly rather than going through the Edge Function, so it
does **not** spend the app's daily chat quota. It does spend the account's
50/day platform limit — 40 cases is most of a day's budget, so use `--limit`
while iterating on the prompt.

## What the fixtures contain

40 cases in the code-switched register the app is actually for. Three
properties are deliberate:

**7 clean cases.** Messages with no English error at all. A model that invents
corrections here is worse than one that misses them: it teaches nonsense and
demoralises the learner. False alarms are scored separately from misses.

**Indonesian in every case.** Any correction whose `original` is Indonesian is
a policy violation (§6.3), counted on its own line, and blocks the verdict
outright.

**Overloaded cases.** `c33` carries five errors — more than the three-per-turn
cap allows. These test prioritisation, not recall.

## Reading the output

| Outcome | Meaning | How bad |
|---|---|---|
| **Right rule** | Found the error, filed it correctly | — |
| **Wrong rule** | Found it, wrong `rule_id` | Bad: poisons the error history |
| **Missed** | Error present, said nothing | Annoying but survivable |
| **False alarm** | Invented a correction | Worst: teaches wrong rules |
| **Touched Indonesian** | Corrected the learner's Indonesian | Blocking: contradicts the premise |
| **Reply not English** | Replied in Indonesian | Blocking: that is the whole product |

`Rule accuracy = right / (right + wrong + missed)`.

## The bar

The run prints PASS or FAIL. It fails on any of:

- Schema violations above 5% — structured output is unreliable on that endpoint
- Any correction that touched Indonesian
- More than 2 false alarms
- Rule accuracy below 80% (the threshold named in SDD §8)

## If it fails

**Try another model before rewriting the prompt.** The model id is an env var
specifically so this stays a one-line change:

```powershell
node bench/run.mjs --model nex-agi/nex-n2.5-pro:free
node bench/run.mjs --model dots-studio/dots-3-note-preview:free
node bench/run.mjs --model anthropic/claude-sonnet-5   # paid, ~$5/mo
```

To switch the app over once you have a winner:

```powershell
supabase secrets set MODEL=the-winning-model
```

No redeploy needed.

A useful calibration run: try `anthropic/claude-sonnet-5` on `--limit 10`. It
costs a few cents and tells you whether a failure is the model's fault or the
fixtures being too harsh. If Sonnet also scores badly on a case, the fixture is
probably wrong.

## Keeping it honest

`bench/run.mjs` duplicates the system prompt from
`supabase/functions/_shared/prompt.ts`. If you change the policy in one, change
it in the other — otherwise the benchmark measures something the app does not
do.
