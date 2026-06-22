import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Single shared Supabase client (singleton) for the whole browser tab.
const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // Surface a clear message during development instead of a cryptic crash.
  // eslint-disable-next-line no-console
  console.warn('[مُحكَم] متغيّرات Supabase غير مضبوطة (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
}

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(url || 'http://localhost', anon || 'public-anon-key', {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'mohkam-auth',
    },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return _client;
}

export const supabase = getSupabase();

export const isSupabaseConfigured = Boolean(url && anon);
