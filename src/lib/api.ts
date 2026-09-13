import { supabase } from './supabase';

export interface SavedCorrection {
  id: number;
  rule_id: string | null;
  original: string;
  corrected: string;
  note: string | null;
}

export interface ChatResponse {
  reply: string;
  corrections: SavedCorrection[];
  vocab_gaps: string[];
  /** True when the model's output failed the schema and we fell back to prose. */
  degraded: boolean;
  user_message_id: number;
  assistant_message_id: number | null;
  quota: { used: number; cap: number };
  streak?: { streak_days: number; is_milestone: boolean } | null;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

/**
 * Errors the chat endpoint can return, carrying a message already written in
 * Indonesian. The UI should never show a raw HTTP status: "quota habis" and
 * "server mati" need different reactions from the user (SDD §7).
 */
export class ChatError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly quota?: { used: number; cap: number },
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

const MESSAGES: Record<string, string> = {
  quota_exhausted: 'Jatah chat hari ini sudah habis. Balik lagi besok ya.',
  upstream_rate_limited:
    'Model lagi ramai atau jatah harian habis. Coba lagi beberapa menit lagi.',
  upstream_failed: 'Model lagi bermasalah. Coba lagi sebentar lagi.',
  empty_reply: 'Model tidak mengirim jawaban. Coba kirim ulang.',
  server_misconfigured:
    'Server belum dikonfigurasi. Cek OPENROUTER_API_KEY di Supabase secrets.',
  unauthorized: 'Sesi kamu habis. Tutup dan buka lagi aplikasinya.',
  message_too_long: 'Pesannya kepanjangan. Coba dipecah jadi beberapa bagian.',
  empty_message: 'Pesannya masih kosong.',
  persist_failed: 'Gagal menyimpan pesan. Coba lagi.',
  quota_check_failed: 'Gagal mengecek jatah harian. Coba lagi.',
  catalogue_empty:
    'Katalog grammar masih kosong. Jalankan supabase/seed.sql dulu.',
  internal_error: 'Ada yang error di server. Coba lagi.',
  network: 'Tidak bisa menghubungi server. Cek koneksi internet kamu.',
};

export async function sendChatMessage(message: string): Promise<ChatResponse> {
  const { data, error } = await supabase.functions.invoke<
    ChatResponse & { error?: string; used?: number; cap?: number }
  >('chat', {
    body: { message },
  });

  if (error) {
    // FunctionsHttpError carries the response body, and every non-2xx reply
    // lands here — so the structured error code has to be read off the
    // context, not off `data`, which is null in that case.
    const context = (error as { context?: Response }).context;

    let body: Record<string, unknown> | null = null;
    if (context && typeof context.json === 'function') {
      // Parse separately from the throw below: wrapping both in one try would
      // catch the ChatError we are trying to raise.
      body = await context.json().catch(() => null);
    }

    if (body) {
      const code = typeof body.error === 'string' ? body.error : 'internal_error';
      const quota =
        typeof body.used === 'number' && typeof body.cap === 'number'
          ? { used: body.used, cap: body.cap }
          : undefined;
      throw new ChatError(code, MESSAGES[code] ?? MESSAGES.internal_error, quota);
    }

    throw new ChatError('network', MESSAGES.network);
  }

  if (!data) throw new ChatError('internal_error', MESSAGES.internal_error);

  return data;
}

export interface Quota {
  used: number;
  cap: number;
  enabled: boolean;
}

export async function fetchQuota(): Promise<Quota> {
  const { data, error } = await supabase.rpc('get_chat_quota').single<Quota>();
  if (error) throw error;
  return data;
}

/**
 * Corrections attached to a set of messages, keyed by the message that caused
 * them. Fetched separately from messages so the chat list can render before
 * the cards resolve.
 */
export async function fetchCorrections(): Promise<
  Record<number, SavedCorrection[]>
> {
  const { data, error } = await supabase
    .from('corrections')
    .select('id, message_id, rule_id, original, corrected, note')
    .eq('dismissed', false)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) throw error;

  const byMessage: Record<number, SavedCorrection[]> = {};
  for (const row of data ?? []) {
    if (row.message_id == null) continue;
    (byMessage[row.message_id] ??= []).push({
      id: row.id,
      rule_id: row.rule_id,
      original: row.original,
      corrected: row.corrected,
      note: row.note,
    });
  }
  return byMessage;
}

/** Hide a correction the learner disagrees with, without deleting the history. */
export async function dismissCorrection(id: number): Promise<void> {
  const { error } = await supabase
    .from('corrections')
    .update({ dismissed: true })
    .eq('id', id);
  if (error) throw error;
}
