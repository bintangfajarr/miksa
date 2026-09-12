/**
 * Database types.
 *
 * Hand-written for now to keep M0 moving. Once the schema settles (M3), swap
 * this for generated types:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type ExplainIn = 'id' | 'en' | 'mix';
export type MessageRole = 'user' | 'assistant';

export interface GrammarRule {
  id: string;
  title_en: string;
  title_id: string;
  cefr: CefrLevel;
  explanation_id: string;
  example_wrong: string;
  example_right: string;
}

export interface Profile {
  id: string;
  cefr_level: CefrLevel;
  native_lang: string;
  vocab_per_day: number;
  explain_in: ExplainIn;
  streak_days: number;
  last_active_on: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  user_id: string;
  role: MessageRole;
  content: string;
  lang_mix: { id: number; en: number } | null;
  created_at: string;
}

export interface Correction {
  id: number;
  user_id: string;
  message_id: number | null;
  rule_id: string | null;
  original: string;
  corrected: string;
  note: string | null;
  dismissed: boolean;
  created_at: string;
}

export interface VocabItem {
  id: number;
  user_id: string;
  word: string;
  meaning_id: string;
  example_en: string;
  served_on: string;
  saved: boolean;
}

export interface UsageDaily {
  user_id: string;
  day: string;
  chat_calls: number;
  vocab_calls: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at'> & { created_at?: string };
        Update: Partial<Message>;
      };
      grammar_rules: {
        Row: GrammarRule;
        Insert: GrammarRule;
        Update: Partial<GrammarRule>;
      };
      corrections: {
        Row: Correction;
        Insert: Omit<Correction, 'id' | 'created_at'> & { created_at?: string };
        Update: Partial<Correction>;
      };
      vocab_items: {
        Row: VocabItem;
        Insert: Omit<VocabItem, 'id'>;
        Update: Partial<VocabItem>;
      };
      usage_daily: {
        Row: UsageDaily;
        Insert: UsageDaily;
        Update: Partial<UsageDaily>;
      };
      app_config: {
        Row: { key: string; value: unknown };
        Insert: { key: string; value: unknown };
        Update: { key?: string; value?: unknown };
      };
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
}
