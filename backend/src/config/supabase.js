const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const requiredKeys = {
  SUPABASE_URL: env.supabaseUrl,
  SUPABASE_ANON_KEY: env.supabaseAnonKey,
  SUPABASE_SERVICE_ROLE_KEY: env.supabaseServiceRoleKey,
};

const missingSupabaseKeys = Object.entries(requiredKeys)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const isConfigured = missingSupabaseKeys.length === 0;

const supabase = isConfigured
  ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

const supabaseAuth = isConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

module.exports = {
  supabase,
  supabaseAuth,
  isSupabaseConfigured: isConfigured,
  missingSupabaseKeys,
};
