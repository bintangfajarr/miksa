/**
 * POST /functions/v1/chat
 *
 * The trust boundary. This is the only place the OpenRouter key exists, and the
 * only place the daily quota can be spent. The phone never talks to OpenRouter
 * directly (SDD §3).
 *
 * M2: returns a structured turn — reply plus classified corrections.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders, json } from '../_shared/cors.ts';
import { buildSystemPrompt, buildTurnSchema, parseTurn } from '../_shared/prompt.ts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

/** Turns kept in context. History costs latency on every single turn. */
const HISTORY_TURNS = 10;
const MAX_INPUT_CHARS = 2000;

/** Rule ids change only when we hand-seed new ones, so cache per instance. */
let ruleIdCache: string[] | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!apiKey || !supabaseUrl || !serviceKey) {
    console.error('Missing required secrets in function environment.');
    return json({ error: 'server_misconfigured' }, 500);
  }

  // --- Identify the caller ------------------------------------------------
  // Verified against Supabase rather than trusting any user_id in the body,
  // which a client could forge.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  // --- Validate input -----------------------------------------------------
  let body: { message?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return json({ error: 'empty_message' }, 400);
  if (message.length > MAX_INPUT_CHARS) {
    return json({ error: 'message_too_long', max: MAX_INPUT_CHARS }, 400);
  }

  // --- Reserve quota ------------------------------------------------------
  // Atomically, before the model call, so two concurrent requests cannot both
  // slip through at the cap. Also carries the kill switch.
  const { data: quota, error: quotaError } = await admin
    .rpc('consume_chat_quota', { p_user_id: userId })
    .single<{ allowed: boolean; used: number; cap: number }>();

  if (quotaError) {
    console.error('Quota RPC failed:', quotaError.message);
    return json({ error: 'quota_check_failed' }, 500);
  }

  if (!quota.allowed) {
    return json({ error: 'quota_exhausted', used: quota.used, cap: quota.cap }, 429);
  }

  const refund = async () => {
    const { error } = await admin.rpc('refund_chat_quota', { p_user_id: userId });
    if (error) console.error('Refund failed:', error.message);
  };

  try {
    // --- Load context -----------------------------------------------------
    const [profileRes, historyRes, rulesRes, weakRes] = await Promise.all([
      admin.from('profiles').select('cefr_level, explain_in').eq('id', userId).single(),
      admin
        .from('messages')
        .select('role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_TURNS * 2),
      ruleIdCache
        ? Promise.resolve({ data: null, error: null })
        : admin.from('grammar_rules').select('id'),
      // The learner's most-broken rules, so the model can praise a repair.
      admin
        .from('corrections')
        .select('rule_id')
        .eq('user_id', userId)
        .not('rule_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

    if (!ruleIdCache) {
      const rows = (rulesRes.data ?? []) as { id: string }[];
      ruleIdCache = rows.map((r) => r.id);
    }
    const ruleIds = ruleIdCache;

    if (ruleIds.length === 0) {
      await refund();
      console.error('grammar_rules is empty — run supabase/seed.sql.');
      return json({ error: 'catalogue_empty' }, 500);
    }

    const profile = profileRes.data ?? { cefr_level: 'B1', explain_in: 'id' };
    const history = (historyRes.data ?? []).reverse();

    // Top 3 by frequency, not recency: one-off slips are not weak points.
    const counts = new Map<string, number>();
    for (const row of (weakRes.data ?? []) as { rule_id: string }[]) {
      counts.set(row.rule_id, (counts.get(row.rule_id) ?? 0) + 1);
    }
    const weakRules = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    // --- Persist the user turn --------------------------------------------
    // Written before the call so the message survives a model failure.
    const { data: userMessage, error: insertError } = await admin
      .from('messages')
      .insert({ user_id: userId, role: 'user', content: message })
      .select('id')
      .single();

    if (insertError) {
      await refund();
      console.error('Failed to persist user message:', insertError.message);
      return json({ error: 'persist_failed' }, 500);
    }

    // --- Call OpenRouter ---------------------------------------------------
    const model = Deno.env.get('MODEL') ?? DEFAULT_MODEL;

    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/bintangfajarr/miksa',
        'X-Title': 'Miksa',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        temperature: 0.6,
        session_id: userId,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt({
              cefrLevel: profile.cefr_level,
              explainIn: profile.explain_in,
              ruleIds,
              weakRules,
            }),
          },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'turn', strict: true, schema: buildTurnSchema(ruleIds) },
        },
        // Without this the request can route to an endpoint that ignores
        // response_format and returns prose. See SDD §4.
        provider: { require_parameters: true },
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error(`OpenRouter ${upstream.status}:`, detail.slice(0, 500));

      // No refund: OpenRouter counted this request even though it failed.
      // Refunding would drift our counter above the real platform limit.
      if (upstream.status === 429) {
        return json({ error: 'upstream_rate_limited' }, 429);
      }
      return json({ error: 'upstream_failed', status: upstream.status }, 502);
    }

    const payload = await upstream.json();
    const rawContent: string | undefined = payload?.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error('Empty content:', JSON.stringify(payload).slice(0, 400));
      return json({ error: 'empty_reply' }, 502);
    }

    // --- Parse, with a graceful fallback -----------------------------------
    // A failed parse must not cost the user their turn: they already paid a
    // request for it. Degrade to a reply-only turn rather than 500.
    let turn = null;
    try {
      turn = parseTurn(JSON.parse(rawContent), new Set(ruleIds));
    } catch {
      console.error('Model returned non-JSON:', rawContent.slice(0, 400));
    }

    if (!turn) {
      const fallback = rawContent.trim().slice(0, 1000);
      await admin
        .from('messages')
        .insert({ user_id: userId, role: 'assistant', content: fallback });

      return json({
        reply: fallback,
        corrections: [],
        vocab_gaps: [],
        degraded: true,
        user_message_id: userMessage.id,
        assistant_message_id: null,
        quota: { used: quota.used, cap: quota.cap },
        model,
      });
    }

    // --- Persist the assistant turn ---------------------------------------
    const { data: assistantMessage, error: replyError } = await admin
      .from('messages')
      .insert({
        user_id: userId,
        role: 'assistant',
        content: turn.reply,
        lang_mix: turn.lang_mix,
      })
      .select('id')
      .single();

    if (replyError) {
      // The reply is good; only the write failed. Return it rather than making
      // the user retype and spend another request.
      console.error('Failed to persist reply:', replyError.message);
    }

    // --- Streak -------------------------------------------------------------
    // After a successful turn, never before: a failed request should not count
    // as showing up. Non-fatal if it fails — a missed streak tick is not worth
    // losing the reply over.
    let streak: { streak_days: number; is_milestone: boolean } | null = null;
    {
      const { data, error } = await admin
        .rpc('touch_streak', { p_user_id: userId })
        .single<{ streak_days: number; is_new_day: boolean; is_milestone: boolean }>();
      if (error) {
        console.error('Streak update failed:', error.message);
      } else if (data) {
        streak = { streak_days: data.streak_days, is_milestone: data.is_milestone };
      }
    }

    // --- Persist corrections ----------------------------------------------
    let savedCorrections: unknown[] = [];
    if (turn.corrections.length > 0) {
      const { data, error } = await admin
        .from('corrections')
        .insert(
          turn.corrections.map((c) => ({
            user_id: userId,
            message_id: userMessage.id,
            rule_id: c.rule_id,
            original: c.original,
            corrected: c.corrected,
            note: c.note,
          })),
        )
        .select('id, rule_id, original, corrected, note');

      if (error) {
        // Non-fatal: the conversation still works, we just lose this entry in
        // the error history.
        console.error('Failed to persist corrections:', error.message);
      } else {
        savedCorrections = data ?? [];
      }
    }

    return json({
      reply: turn.reply,
      corrections: savedCorrections,
      vocab_gaps: turn.vocab_gaps,
      degraded: false,
      user_message_id: userMessage.id,
      assistant_message_id: assistantMessage?.id ?? null,
      quota: { used: quota.used, cap: quota.cap },
      streak,
      model,
      usage: payload?.usage ?? null,
    });
  } catch (err) {
    await refund();
    console.error('Unhandled error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});
