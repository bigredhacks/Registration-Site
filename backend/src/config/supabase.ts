import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and a backend Supabase key.');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseSecretKey);
