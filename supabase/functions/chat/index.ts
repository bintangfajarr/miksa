/**
 * POST /functions/v1/chat
 *
 * The trust boundary. This is the only place the OpenRouter key exists, and
 * the only place the daily quota can be spent. The phone never talks to
 * OpenRouter directly (SDD §3).
 *
 * M1 scope: reply only. Structured corrections arrive at M2.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders, json } from '../_shared/cors.ts';
import { buildSystemPrompt } from '../_shared/prompt.ts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

/** Turns kept in context. More history costs latency on every single turn. */
const HISTORY_TURNS = 10;

/** Cap on what a single message may contain, in characters. */
const MAX_INPUT_CHARS = 2000;

interface ChatRequest {
  message?: unknown;
}

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
  // The JWT comes from the phone. We verify it against Supabase rather than
  // trusting any user_id in the body, which a client could forge.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return json({ error: 'unauthorized' }, 401);
  }
  const userId = userData.user.id;

  // --- Validate input -----------------------------------------------------
  let body: ChatRequest;
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
  // Before the model call, atomically, so two concurrent requests cannot both
  // slip through at the cap. Also carries the kill switch.
  const { data: quota, error: quotaError } = await admin
    .rpc('consume_chat_quota', { p_user_id: userId })
    .single<{ allowed: boolean; used: number; cap: number }>();

  if (quotaError) {
    console.error('Quota RPC failed:', quotaError.message);
    return json({ error: 'quota_check_failed' }, 500);
  }

  if (!quota.allowed) {
    return json(
      {
        error: 'quota_exhausted',
        used: quota.used,
        cap: quota.cap,
        message_id: 'Jatah chat hari ini sudah habis. Balik lagi besok ya.',
      },
      429,
    );
  }

  /** Hand back the reservation — only for failures before OpenRouter is hit. */
  const refund = async () => {
    const { error } = await admin.rpc('refund_chat_quota', {
      p_user_id: userId,
    });
    if (error) console.error('Refund failed:', error.message);
  };

  try {
    // --- Load profile + recent history ------------------------------------
    const [profileRes, historyRes] = await Promise.all([
      admin
        .from('profiles')
        .select('cefr_level, explain_in')
        .eq('id', userId)
        .single(),
      admin
        .from('messages')
        .select('role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_TURNS * 2),
    ]);

    const profile = profileRes.data ?? { cefr_level: 'B1', explain_in: 'id' };
    const history = (historyRes.data ?? []).reverse();

    // --- Persist the user turn --------------------------------------------
    // Written before the call so the message is not lost if the model fails.
    const { data: userMessage, error: insertError } = await admin
      .from('messages')
      .insert({ user_id: userId, role: 'user', content: message })
      .select('id, created_at')
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
        // Identifies the app on OpenRouter's dashboard.
        'HTTP-Referer': 'https://github.com/bintangfajarr/miksa',
        'X-Title': 'Miksa',
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        temperature: 0.7,
        // Keeps multi-turn conversations on one provider, which matters for
        // consistency of voice across a session.
        session_id: userId,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt({
              cefrLevel: profile.cefr_level,
              explainIn: profile.explain_in,
            }),
          },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error(`OpenRouter ${upstream.status}:`, detail.slice(0, 500));

      // No refund here: OpenRouter counted this request even though it failed.
      // Refunding would let our counter drift above the real platform limit.
      if (upstream.status === 429) {
        return json(
          {
            error: 'upstream_rate_limited',
            message_id:
              'Model lagi ramai atau jatah harian OpenRouter habis. Coba lagi nanti ya.',
          },
          429,
        );
      }
      return json({ error: 'upstream_failed', status: upstream.status }, 502);
    }

    const payload = await upstream.json();
    const reply: string | undefined = payload?.choices?.[0]?.message?.content;

    if (!reply || !reply.trim()) {
      console.error('Empty reply from model:', JSON.stringify(payload).slice(0, 500));
      return json({ error: 'empty_reply' }, 502);
    }

    // --- Persist the assistant turn ---------------------------------------
    const { data: assistantMessage, error: replyError } = await admin
      .from('messages')
      .insert({ user_id: userId, role: 'assistant', content: reply.trim() })
      .select('id, created_at')
      .single();

    if (replyError) {
      // The reply is good; only the write failed. Return it anyway rather than
      // making the user retype and spend another request.
      console.error('Failed to persist reply:', replyError.message);
    }

    return json({
      reply: reply.trim(),
      user_message_id: userMessage.id,
      assistant_message_id: assistantMessage?.id ?? null,
      quota: { used: quota.used, cap: quota.cap },
      model,
      usage: payload?.usage ?? null,
    });
  } catch (err) {
    // Reached only for failures on our side of the OpenRouter call.
    await refund();
    console.error('Unhandled error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});
