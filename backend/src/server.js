const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const { isSupabaseConfigured, missingSupabaseKeys } = require('./config/supabase');
const requireAuth = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middleware/errorHandler');
const depositRoutes = require('./routes/depositRoutes');
const walletRoutes = require('./routes/walletRoutes');
const { startTronListener } = require('./blockchain/tronListener');

const app = express();

app.set('etag', false);
app.use(helmet());
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'payx-backend',
    demoMode: env.demoAutoConfirm,
    supabaseConfigured: isSupabaseConfigured,
    missingSupabaseKeys,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);
app.use('/api/deposits', depositRoutes);
app.use('/api/wallet', walletRoutes);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`PayX backend running on http://localhost:${env.port}`);
  startTronListener();
});
