/**
 * Database types.
 *
 * Hand-written for now. Once the schema settles (M3), swap for generated ones:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * NOTE: every row type below is a `type` alias, never an `interface`.
 * supabase-js constrains rows to `Record<string, unknown>`, and an interface
 * does not satisfy that — interfaces get no implicit index signature, type
 * aliases do. Declare one of these as an interface and every query result
 * silently collapses to `never`, surfacing as "Property 'x' does not exist on
 * type 'never'" at the call site rather than here.
 */

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type ExplainIn = 'id' | 'en' | 'mix';
export type MessageRole = 'user' | 'assistant';

export type GrammarRule = {
  id: string;
  title_en: string;
  title_id: string;
  cefr: CefrLevel;
  explanation_id: string;
  example_wrong: string;
  example_right: string;
};

export type Profile = {
  id: string;
  cefr_level: CefrLevel;
  native_lang: string;
  vocab_per_day: number;
  explain_in: ExplainIn;
  streak_days: number;
  last_active_on: string | null;
  created_at: string;
};

export type Message = {
  id: number;
  user_id: string;
  role: MessageRole;
  content: string;
  lang_mix: { id: number; en: number } | null;
  created_at: string;
};

export type Correction = {
  id: number;
  user_id: string;
  message_id: number | null;
  rule_id: string | null;
  original: string;
  corrected: string;
  note: string | null;
  dismissed: boolean;
  created_at: string;
};

export type VocabItem = {
  id: number;
  user_id: string;
  word: string;
  meaning_id: string;
  example_en: string;
  served_on: string;
  saved: boolean;
};

export type UsageDaily = {
  user_id: string;
  day: string;
  chat_calls: number;
  vocab_calls: number;
};

/**
 * supabase-js resolves row types through this shape and requires a
 * `Relationships` key on every table. Omitting it collapses query results to
 * `never`, same as the interface/type trap described above.
 */
type Table<Row, Insert = Row, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, Partial<Profile> & { id: string }>;
      messages: Table<
        Message,
        Omit<Message, 'id' | 'created_at'> & { created_at?: string }
      >;
      grammar_rules: Table<GrammarRule>;
      corrections: Table<
        Correction,
        Omit<Correction, 'id' | 'created_at'> & { created_at?: string }
      >;
      vocab_items: Table<VocabItem, Omit<VocabItem, 'id'>>;
      usage_daily: Table<UsageDaily>;
      app_config: Table<{ key: string; value: unknown }>;
    };
    Views: Record<string, never>;
    Functions: {
      get_chat_quota: {
        Args: Record<string, never>;
        Returns: { used: number; cap: number; enabled: boolean }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
