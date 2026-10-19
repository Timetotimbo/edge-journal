import { createClient } from '@supabase/supabase-js';

// The Social Bloom project: the journal signs in with the same account, and its tables only show your own rows
export const supabase = createClient(
  'https://yrrlzqdabodopzaqjlwf.supabase.co',
  'sb_publishable_T-3IqHtHVZe4S_pqZAlM4g_9HVqu6J9',
  { auth: { persistSession: true, autoRefreshToken: true } },
);
