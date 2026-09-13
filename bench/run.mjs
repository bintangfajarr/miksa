#!/usr/bin/env node
/**
 * M2 model benchmark (SDD §8).
 *
 * Answers one question: is the free model good enough to build on?
 *
 * A wrong correction teaches a wrong rule (SDD §10), so this measures more
 * than "did it find the error". It separates four failure modes that need
 * completely different reactions:
 *
 *   - MISSED       the error was there, the model said nothing. Annoying.
 *   - WRONG RULE   found it but filed it under the wrong id. Poisons the
 *                  error history, which is the product's entire asset (§1).
 *   - FALSE ALARM  invented a correction for correct English. Actively
 *                  harmful: teaches nonsense and demoralises the learner.
 *   - TOUCHED ID   corrected the learner's Indonesian. A policy violation,
 *                  and a direct contradiction of the product premise (§6.3).
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-or-... node bench/run.mjs
 *   OPENROUTER_API_KEY=sk-or-... node bench/run.mjs --model anthropic/claude-sonnet-5
 *   OPENROUTER_API_KEY=sk-or-... node bench/run.mjs --limit 5 --verbose
 *
 * Runs against OpenRouter directly, not through the Edge Function, so it does
 * not spend the app's daily chat quota. It does spend the account's 50/day
 * platform limit, so --limit exists for iterating on the prompt.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error('Set OPENROUTER_API_KEY first.\n');
  console.error('  $env:OPENROUTER_API_KEY = "sk-or-v1-..."   # PowerShell');
  console.error('  export OPENROUTER_API_KEY=sk-or-v1-...     # bash');
  process.exit(1);
}

// --- args -------------------------------------------------------------------
const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const MODEL = argValue('--model', 'nvidia/nemotron-3-super-120b-a12b:free');
const LIMIT = Number(argValue('--limit', '0')) || 0;
const VERBOSE = args.includes('--verbose');
const DELAY_MS = Number(argValue('--delay', '3500'));

// --- fixtures + rule ids ----------------------------------------------------
const fixtures = JSON.parse(
  readFileSync(join(here, 'fixtures.json'), 'utf8'),
);

const seed = readFileSync(join(here, '..', 'supabase', 'seed.sql'), 'utf8');
const RULE_IDS = [...seed.matchAll(/^\('([a-z][a-z0-9-]*)',/gm)].map((m) => m[1]);

if (RULE_IDS.length < 20) {
  console.error(`Only parsed ${RULE_IDS.length} rule ids from seed.sql — check the format.`);
  process.exit(1);
}

const cases = LIMIT ? fixtures.cases.slice(0, LIMIT) : fixtures.cases;

// --- prompt + schema --------------------------------------------------------
// Mirrors what the Edge Function will send at M2. Keep the two in sync, or the
// benchmark measures something the app does not do.
const SYSTEM_PROMPT = `You are Miksa, an English tutor for Indonesian learners at CEFR B1.

The learner writes in a mix of Indonesian and English. This is code-switching,
it is normal bilingual behaviour, and it is expected.

REPLY
- Always reply in ENGLISH, 2-4 short sentences, B1-friendly vocabulary.
- Reply to what they MEANT, reading the Indonesian parts for intent.

CORRECTIONS
- Correct their ENGLISH only. NEVER correct or rewrite their Indonesian.
- At most 3 corrections, most important first. Silently drop the rest.
- If their English is already correct, return an empty corrections array.
  Do not invent corrections to seem useful.
- Each correction needs a rule_id from the catalogue below, or null if no
  catalogue entry fits.
- The note explains, in INDONESIAN, in one line, why it was wrong.

RULE CATALOGUE
${RULE_IDS.join(', ')}

VOCAB GAPS
List ideas the learner could only express in Indonesian — the concepts worth
teaching next. Use the English word they were reaching for.`;

const schema = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Conversational reply in English.' },
    lang_mix: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        en: { type: 'number' },
      },
      required: ['id', 'en'],
      additionalProperties: false,
    },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          original: { type: 'string' },
          corrected: { type: 'string' },
          rule_id: { type: ['string', 'null'], enum: [...RULE_IDS, null] },
          note: { type: 'string', description: 'One line, in Indonesian.' },
        },
        required: ['original', 'corrected', 'rule_id', 'note'],
        additionalProperties: false,
      },
    },
    vocab_gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['reply', 'lang_mix', 'corrections', 'vocab_gaps'],
  additionalProperties: false,
};

// --- helpers ----------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

/**
 * Heuristic: does this look like Indonesian rather than English?
 *
 * Used only to flag corrections that touched the learner's Indonesian. Common
 * function words are the reliable signal; content words overlap too much.
 */
const ID_MARKERS = [
  'yang', 'aku', 'saya', 'kamu', 'nya', 'udah', 'sudah', 'ga ', 'gak', 'nggak',
  'banget', 'sih', 'dong', 'deh', 'kalau', 'kalo', 'sama', 'juga', 'tapi',
  'buat', 'bikin', 'gimana', 'kenapa', 'karena', 'jadi ', 'lagi ', 'masih',
  'belum', 'bisa', 'mau', 'pengen', 'ke ', 'di ', 'dari', 'untuk', 'dengan',
];

function looksIndonesian(text) {
  const t = ` ${text.toLowerCase()} `;
  const hits = ID_MARKERS.filter((m) => t.includes(m)).length;
  return hits >= 2;
}

async function callModel(message) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/bintangfajarr/miksa',
      'X-Title': 'Miksa benchmark',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.3, // Lower than production: we are measuring, not chatting.
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'turn', strict: true, schema },
      },
      // Without this, the request can route to an endpoint that ignores
      // response_format and returns prose. See SDD §4.
      provider: { require_parameters: true },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const payload = await res.json();
  const raw = payload?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty response body.');

  return { parsed: JSON.parse(raw), usage: payload.usage };
}

// --- run --------------------------------------------------------------------
console.log(c.bold('\nMiksa — M2 model benchmark'));
console.log(c.dim(`model   ${MODEL}`));
console.log(c.dim(`cases   ${cases.length} (${RULE_IDS.length} rules in catalogue)`));
console.log(c.dim(`delay   ${DELAY_MS}ms between calls (free tier: 20 req/min)\n`));

const stats = {
  total: 0,
  parseFailed: 0,
  apiFailed: 0,
  exactRule: 0,       // right error, right rule id
  wrongRule: 0,       // right error, wrong rule id
  missed: 0,          // error present, nothing returned
  falseAlarm: 0,      // clean input, correction invented
  cleanPassed: 0,     // clean input, correctly left alone
  touchedIndonesian: 0,
  overCap: 0,         // more than three corrections
  nullRules: 0,
  replyNotEnglish: 0,
};

const failures = [];

for (const [i, testCase] of cases.entries()) {
  const label = `${testCase.id} [${i + 1}/${cases.length}]`;
  process.stdout.write(`${c.dim(label)} `);

  stats.total += 1;

  let result;
  try {
    result = await callModel(testCase.message);
  } catch (err) {
    stats.apiFailed += 1;
    console.log(c.red(`API ERROR — ${err.message.slice(0, 120)}`));
    if (/429/.test(err.message)) {
      console.log(c.yellow('\nRate limited. Free tier is 20/min and 50/day.'));
      console.log(c.yellow('Wait, then re-run with --limit to resume in batches.\n'));
      break;
    }
    await sleep(DELAY_MS);
    continue;
  }

  const { parsed } = result;
  if (!parsed || !Array.isArray(parsed.corrections)) {
    stats.parseFailed += 1;
    console.log(c.red('SCHEMA VIOLATION'));
    failures.push({ id: testCase.id, kind: 'schema', detail: JSON.stringify(parsed).slice(0, 200) });
    await sleep(DELAY_MS);
    continue;
  }

  const corrections = parsed.corrections;
  const returnedIds = corrections.map((x) => x.rule_id).filter(Boolean);
  const expected = testCase.expect;

  if (corrections.length > 3) stats.overCap += 1;
  stats.nullRules += corrections.filter((x) => x.rule_id === null).length;

  const touched = corrections.filter((x) => looksIndonesian(x.original));
  if (touched.length) {
    stats.touchedIndonesian += touched.length;
    failures.push({
      id: testCase.id,
      kind: 'touched-indonesian',
      detail: touched.map((t) => `"${t.original}" → "${t.corrected}"`).join('; '),
    });
  }

  // A reply that is not in English breaks the product's core promise.
  if (parsed.reply && looksIndonesian(parsed.reply)) {
    stats.replyNotEnglish += 1;
    failures.push({ id: testCase.id, kind: 'reply-not-english', detail: parsed.reply.slice(0, 120) });
  }

  let verdict;
  if (expected.length === 0) {
    // Clean case: silence is the correct answer.
    if (corrections.length === 0) {
      stats.cleanPassed += 1;
      verdict = c.green('CLEAN OK');
    } else {
      stats.falseAlarm += corrections.length;
      verdict = c.red(`FALSE ALARM (${corrections.length})`);
      failures.push({
        id: testCase.id,
        kind: 'false-alarm',
        detail: corrections.map((x) => `${x.rule_id}: "${x.original}"`).join('; '),
      });
    }
  } else if (corrections.length === 0) {
    stats.missed += 1;
    verdict = c.yellow('MISSED');
    failures.push({ id: testCase.id, kind: 'missed', detail: expected.join(', ') });
  } else {
    const hit = expected.filter((id) => returnedIds.includes(id));
    if (hit.length > 0) {
      stats.exactRule += 1;
      verdict = c.green(`OK (${hit.join(', ')})`);
    } else {
      stats.wrongRule += 1;
      verdict = c.red(`WRONG RULE (got ${returnedIds.join(', ') || 'null'}, want ${expected.join(', ')})`);
      failures.push({
        id: testCase.id,
        kind: 'wrong-rule',
        detail: `got [${returnedIds.join(', ')}] want [${expected.join(', ')}]`,
      });
    }
  }

  console.log(verdict);

  if (VERBOSE) {
    console.log(c.dim(`   in    ${testCase.message}`));
    console.log(c.cyan(`   reply ${parsed.reply}`));
    for (const corr of corrections) {
      console.log(c.dim(`   fix   [${corr.rule_id}] "${corr.original}" → "${corr.corrected}"`));
      console.log(c.dim(`         ${corr.note}`));
    }
    if (parsed.vocab_gaps?.length) {
      console.log(c.dim(`   gaps  ${parsed.vocab_gaps.join(', ')}`));
    }
    console.log();
  }

  await sleep(DELAY_MS);
}

// --- report -----------------------------------------------------------------
const scored = stats.exactRule + stats.wrongRule + stats.missed;
const cleanCases = stats.cleanPassed + cases.filter((t) => t.expect.length === 0).length - stats.cleanPassed;
const ruleAccuracy = scored ? (stats.exactRule / scored) * 100 : 0;

console.log(c.bold('\n─────────────────────────────────────────'));
console.log(c.bold('Results'));
console.log(c.bold('─────────────────────────────────────────'));
console.log(`  Cases run             ${stats.total}`);
console.log(`  API failures          ${stats.apiFailed}`);
console.log(`  Schema violations     ${stats.parseFailed}`);
console.log();
console.log(c.bold('  Error cases'));
console.log(`    Right rule          ${c.green(String(stats.exactRule))}`);
console.log(`    Wrong rule          ${c.red(String(stats.wrongRule))}`);
console.log(`    Missed entirely     ${c.yellow(String(stats.missed))}`);
console.log(`    ${c.bold('Rule accuracy')}       ${c.bold(ruleAccuracy.toFixed(1) + '%')}`);
console.log();
console.log(c.bold('  Clean cases'));
console.log(`    Correctly silent    ${c.green(String(stats.cleanPassed))}`);
console.log(`    False alarms        ${c.red(String(stats.falseAlarm))}`);
console.log();
console.log(c.bold('  Policy'));
console.log(`    Touched Indonesian  ${stats.touchedIndonesian ? c.red(String(stats.touchedIndonesian)) : c.green('0')}`);
console.log(`    Reply not English   ${stats.replyNotEnglish ? c.red(String(stats.replyNotEnglish)) : c.green('0')}`);
console.log(`    Over 3-correction   ${stats.overCap ? c.yellow(String(stats.overCap)) : c.green('0')}`);
console.log(`    Uncatalogued (null) ${stats.nullRules}`);

if (failures.length) {
  console.log(c.bold('\n─────────────────────────────────────────'));
  console.log(c.bold('Failures'));
  console.log(c.bold('─────────────────────────────────────────'));
  for (const f of failures) {
    console.log(`  ${c.dim(f.id)} ${c.yellow(f.kind)}`);
    console.log(`     ${f.detail}`);
  }
}

console.log(c.bold('\n─────────────────────────────────────────'));
console.log(c.bold('Verdict'));
console.log(c.bold('─────────────────────────────────────────'));

const blocking = [];
if (stats.parseFailed > stats.total * 0.05) {
  blocking.push('Schema violations above 5% — structured output is unreliable on this endpoint.');
}
if (stats.touchedIndonesian > 0) {
  blocking.push('Corrected the learner\'s Indonesian — contradicts the product premise (§6.3).');
}
if (stats.falseAlarm > 2) {
  blocking.push('Invents corrections for correct English — teaches wrong rules (§10).');
}
if (ruleAccuracy < 80) {
  blocking.push(`Rule accuracy ${ruleAccuracy.toFixed(1)}% is below the 80% bar in SDD §8.`);
}

if (blocking.length === 0) {
  console.log(c.green('  PASS — good enough to build on. Ship it and stop thinking about it.'));
} else {
  console.log(c.red('  FAIL — do not build the collection screen on this yet.\n'));
  for (const b of blocking) console.log(c.red(`    · ${b}`));
  console.log(c.dim('\n  Next: try another model before rewriting the prompt.'));
  console.log(c.dim('    node bench/run.mjs --model nex-agi/nex-n2.5-pro:free'));
  console.log(c.dim('    node bench/run.mjs --model anthropic/claude-sonnet-5'));
}
console.log();
