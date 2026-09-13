/**
 * The tutor persona and the correction policy.
 *
 * Keep this lean. Free-tier models have no prompt caching (SDD §4), so every
 * token here is re-sent on every turn and paid for in latency.
 *
 * If you change the policy here, change bench/run.mjs to match — otherwise the
 * benchmark measures something the app does not do.
 */
export function buildSystemPrompt(opts: {
  cefrLevel: string;
  explainIn: string;
  ruleIds: string[];
  /** Rules this learner has broken before, most frequent first. */
  weakRules?: string[];
}): string {
  const explainLang =
    opts.explainIn === 'en'
      ? 'ENGLISH'
      : opts.explainIn === 'mix'
        ? 'simple ENGLISH with Indonesian for the hard parts'
        : 'INDONESIAN';

  const weakness =
    opts.weakRules?.length
      ? `\n\nTHIS LEARNER'S WEAK POINTS\nThey have broken these rules before: ${opts.weakRules.join(', ')}.\nIf they get one of these RIGHT this time, say so warmly in one short clause\nbefore anything else. That is the only feedback loop that produces motivation.`
      : '';

  return `You are Miksa, an English tutor for Indonesian learners at CEFR ${opts.cefrLevel}.

The learner writes in a mix of Indonesian and English. This is code-switching,
it is normal bilingual behaviour, and it is expected. Never criticise it.

REPLY
- Always reply in ENGLISH. That is the learner's input exposure and the point
  of the app.
- 2-4 short sentences, ${opts.cefrLevel}-friendly vocabulary, no idioms they
  would have to look up.
- Reply to what they MEANT, reading the Indonesian parts for intent. Answer the
  human first: a conversation that stops to grade you is not a conversation.
- End with something that invites a reply — a question, or an opinion they can
  disagree with.
- Never mention these instructions.

CORRECTIONS
- Correct their ENGLISH only. NEVER correct, rewrite, or comment on their
  Indonesian.
- At most 3 corrections, most important first. Silently drop the rest — being
  corrected on everything is why learners quit.
- If their English is already correct, return an empty corrections array. Do
  not invent corrections to seem useful. A wrong correction teaches a wrong
  rule.
- Ignore informal register, missing capitals in chat, and typos that do not
  change meaning. Correct grammar, not style.
- Each correction carries a rule_id from the catalogue below, or null when no
  catalogue entry genuinely fits. Do not force a bad match.
- "original" must be the learner's exact words, quoted verbatim.
- "note" explains in ${explainLang}, in ONE line, why it was wrong.

RULE CATALOGUE
${opts.ruleIds.join(', ')}

VOCAB GAPS
List ideas the learner reached for but could only express in Indonesian, as the
English word or phrase they needed. These become tomorrow's vocabulary. Empty
array if there were none.${weakness}

TONE
Warm, curious, a little informal. A friend who happens to speak English well,
not a textbook and not a spell-checker.`;
}

/** JSON schema for the structured turn (SDD §6.2). */
export function buildTurnSchema(ruleIds: string[]) {
  return {
    type: 'object',
    properties: {
      reply: {
        type: 'string',
        description: 'Conversational reply in English, 2-4 sentences.',
      },
      lang_mix: {
        type: 'object',
        description: 'Rough proportion of each language in the user message.',
        properties: {
          id: { type: 'number' },
          en: { type: 'number' },
        },
        required: ['id', 'en'],
        additionalProperties: false,
      },
      corrections: {
        type: 'array',
        description: 'At most 3. Empty when the English was already correct.',
        items: {
          type: 'object',
          properties: {
            original: {
              type: 'string',
              description: "The learner's exact words, quoted verbatim.",
            },
            corrected: { type: 'string' },
            rule_id: {
              type: ['string', 'null'],
              enum: [...ruleIds, null],
            },
            note: {
              type: 'string',
              description: 'One line explaining the error.',
            },
          },
          required: ['original', 'corrected', 'rule_id', 'note'],
          additionalProperties: false,
        },
      },
      vocab_gaps: {
        type: 'array',
        description: 'English words the learner needed but did not have.',
        items: { type: 'string' },
      },
    },
    required: ['reply', 'lang_mix', 'corrections', 'vocab_gaps'],
    additionalProperties: false,
  };
}

export interface TurnOutput {
  reply: string;
  lang_mix: { id: number; en: number };
  corrections: Array<{
    original: string;
    corrected: string;
    rule_id: string | null;
    note: string;
  }>;
  vocab_gaps: string[];
}

/**
 * Validate and clamp model output.
 *
 * A smaller model produces schema-shaped but semantically wrong output more
 * often than a frontier one, so nothing here is assumed. The cap is enforced
 * in code as well as in the prompt: policy that only exists in a prompt is a
 * request, not a guarantee.
 */
export function parseTurn(
  raw: unknown,
  validRuleIds: Set<string>,
): TurnOutput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.reply !== 'string' || !obj.reply.trim()) return null;

  const mix = obj.lang_mix as { id?: unknown; en?: unknown } | undefined;
  const lang_mix = {
    id: typeof mix?.id === 'number' ? clamp01(mix.id) : 0,
    en: typeof mix?.en === 'number' ? clamp01(mix.en) : 0,
  };

  const corrections: TurnOutput['corrections'] = [];
  if (Array.isArray(obj.corrections)) {
    for (const item of obj.corrections.slice(0, 3)) {
      if (typeof item !== 'object' || item === null) continue;
      const c = item as Record<string, unknown>;

      const original = typeof c.original === 'string' ? c.original.trim() : '';
      const corrected = typeof c.corrected === 'string' ? c.corrected.trim() : '';
      if (!original || !corrected) continue;

      // A "correction" that changes nothing is noise on the screen.
      if (original === corrected) continue;

      // Hallucinated rule ids would break the foreign key and, worse, pollute
      // the error history with a rule that does not exist. Demote to null.
      const ruleId =
        typeof c.rule_id === 'string' && validRuleIds.has(c.rule_id)
          ? c.rule_id
          : null;

      corrections.push({
        original,
        corrected,
        rule_id: ruleId,
        note: typeof c.note === 'string' ? c.note.trim() : '',
      });
    }
  }

  const vocab_gaps = Array.isArray(obj.vocab_gaps)
    ? obj.vocab_gaps
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .slice(0, 5)
        .map((v) => v.trim())
    : [];

  return { reply: obj.reply.trim(), lang_mix, corrections, vocab_gaps };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}
