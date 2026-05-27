const { supabase, supabaseAuth, isSupabaseConfigured, missingSupabaseKeys } = require('../config/supabase');

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeUsername(username) {
  return String(username || '')
    .trim()
    .toLowerCase();
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw createHttpError(`Supabase is not configured on the backend. Missing: ${missingSupabaseKeys.join(', ')}`, 503);
  }
}

function validateRegistration(payload) {
  const username = normalizeUsername(payload.username);
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  const fullName = String(payload.fullName || '').trim();
  const location = String(payload.location || '').trim();

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    throw createHttpError('Username must be 3-24 characters and use letters, numbers, or underscores.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createHttpError('A valid email is required.');
  }

  if (password.length < 8) {
    throw createHttpError('Password must be at least 8 characters.');
  }

  if (!fullName) {
    throw createHttpError('Full name is required.');
  }

  if (!location) {
    throw createHttpError('Location is required.');
  }

  return { username, email, password, fullName, location };
}

async function getProfile(userId) {
  assertConfigured();

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function resolveEmail(identifier) {
  const normalized = String(identifier || '').trim().toLowerCase();

  if (!normalized) {
    throw createHttpError('Username or email is required.');
  }

  if (normalized.includes('@')) {
    return normalized;
  }

  const { data, error } = await supabase.from('profiles').select('email').eq('username', normalized).maybeSingle();

  if (error) throw error;
  if (!data?.email) {
    throw createHttpError('Invalid login credentials.', 401);
  }

  return data.email;
}

async function register(payload) {
  assertConfigured();
  const values = validateRegistration(payload);

  const [usernameLookup, emailLookup] = await Promise.all([
    supabase.from('profiles').select('id').eq('username', values.username).maybeSingle(),
    supabase.from('profiles').select('id').eq('email', values.email).maybeSingle(),
  ]);

  if (usernameLookup.error) throw usernameLookup.error;
  if (emailLookup.error) throw emailLookup.error;
  if (usernameLookup.data || emailLookup.data) {
    throw createHttpError('Username or email is already registered.', 409);
  }

  const { data, error } = await supabaseAuth.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: {
        username: values.username,
        full_name: values.fullName,
        location: values.location,
      },
    },
  });

  if (error) {
    throw createHttpError(error.message, error.status || 400);
  }

  if (!data.user) {
    throw createHttpError('Registration did not return a Supabase user.', 502);
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    username: values.username,
    email: values.email,
    full_name: values.fullName,
    location: values.location,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw profileError;
  }

  const { error: balanceError } = await supabase.from('wallet_balances').insert({
    user_id: data.user.id,
    balance: 0,
  });

  if (balanceError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw balanceError;
  }

  return {
    user: data.user,
    session: data.session,
    profile: await getProfile(data.user.id),
  };
}

async function login({ identifier, password }) {
  assertConfigured();

  const email = await resolveEmail(identifier);
  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email,
    password: String(password || ''),
  });

  if (error) {
    throw createHttpError('Invalid login credentials.', 401);
  }

  return {
    user: data.user,
    session: data.session,
    profile: await getProfile(data.user.id),
  };
}

module.exports = {
  register,
  login,
  getProfile,
};
