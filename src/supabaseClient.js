import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client using Vite env vars.
// Define these in a .env.local file at project root:
// VITE_SUPABASE_URL=...
// VITE_SUPABASE_ANON_KEY=...
export const hasSupabaseEnv = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

if (!hasSupabaseEnv) {
  // Provide a clear hint in dev consoles without breaking the app import.
  console.error(
    'Supabase env vars missing. Define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.'
  );
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'anon',
  { auth: { persistSession: true, autoRefreshToken: true } }
);
