/**
 * Environment configuration.
 *
 * Only EXPO_PUBLIC_* variables are available on the client, and they are
 * inlined into the bundle at build time. That is fine for the Supabase URL
 * and anon key (both are protected by row-level security) and absolutely not
 * fine for anything else. The OpenRouter key lives in a Supabase Edge Function
 * secret and never appears here. See SDD §3.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.startsWith('your-')) {
    throw new Error(
      `Missing env var ${name}.\n\n` +
        `Copy .env.example to .env and fill in your Supabase project values.\n` +
        `You can find them at: Supabase dashboard → Project Settings → Data API.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
};
