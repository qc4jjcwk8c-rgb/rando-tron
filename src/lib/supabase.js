import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Graceful fallback — app runs in local-only mode if env vars aren't set
export const supabase = (url && key) ? createClient(url, key) : null;
