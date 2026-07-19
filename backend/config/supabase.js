import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
export const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'reports';

if (!supabaseUrl || !supabaseKey) {
  console.warn('[SUPABASE] Warning: SUPABASE_URL or SUPABASE Key is not defined in the environment.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});
