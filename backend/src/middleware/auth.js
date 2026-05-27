const { supabaseAuth, isSupabaseConfigured } = require('../config/supabase');

const requireAuth = async (req, res, next) => {
  if (!isSupabaseConfigured) {
    req.user = {
      id: req.header('x-demo-user-id') || '101',
      email: 'player@payx.local',
    };
    return next();
  }

  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required.' });
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ message: 'Invalid or expired session.' });
  }

  req.user = {
    id: data.user.id,
    email: data.user.email,
  };

  return next();
};

module.exports = requireAuth;
