require('dotenv').config();

const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  tronFullHost: process.env.TRON_FULL_HOST || 'https://api.trongrid.io',
  tronGridApiKey: process.env.TRONGRID_API_KEY || '',
  usdtContract: process.env.USDT_TRC20_CONTRACT || 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj',
  platformDepositAddress: process.env.PLATFORM_DEPOSIT_ADDRESS || 'TXYZplatformwalletdemo',
  walletPool: (process.env.DEPOSIT_WALLET_POOL || 'TXYZplatformwalletdemo,TAAAuserdemo,TBBBuserdemo')
    .split(',')
    .map((wallet) => wallet.trim())
    .filter(Boolean),
  depositExpiryMinutes: Number(process.env.DEPOSIT_EXPIRY_MINUTES || 5),
  demoAutoConfirm: process.env.DEMO_AUTO_CONFIRM !== 'false',
  demoConfirmSeconds: Number(process.env.DEMO_CONFIRM_SECONDS || 14),
};

module.exports = env;
