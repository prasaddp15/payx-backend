const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const env = require('../config/env');
const walletService = require('./walletService');
const { supabase, isSupabaseConfigured } = require('../config/supabase');

const memoryDeposits = new Map();
const statusOrder = ['pending', 'detecting', 'confirming', 'completed'];

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assignDepositWallet(userId) {
  if (!env.walletPool.length) return env.platformDepositAddress;
  const numeric = String(userId)
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return env.walletPool[numeric % env.walletPool.length];
}

function createQrPayload({ walletAddress, amount }) {
  return `tron:${walletAddress}?token=USDT&amount=${amount}`;
}

async function createDepositQrCode({ walletAddress, amount }) {
  return QRCode.toDataURL(createQrPayload({ walletAddress, amount }), { margin: 1, width: 280 });
}

async function persistDeposit(deposit) {
  if (!isSupabaseConfigured) {
    memoryDeposits.set(deposit.id, deposit);
    return deposit;
  }

  const { data, error } = await supabase
    .from('deposits')
    .insert({
      id: deposit.id,
      user_id: deposit.userId,
      amount: deposit.amount,
      wallet_address: deposit.walletAddress,
      status: deposit.status,
      expires_at: deposit.expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    ...deposit,
    createdAt: data.created_at,
  };
}

async function updateDepositStatus(depositId, patch) {
  if (!isSupabaseConfigured) {
    const current = memoryDeposits.get(depositId);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    memoryDeposits.set(depositId, next);
    return next;
  }

  const { data, error } = await supabase
    .from('deposits')
    .update({
      status: patch.status,
      tx_hash: patch.txHash,
      confirmations: patch.confirmations,
      updated_at: new Date().toISOString(),
    })
    .eq('id', depositId)
    .select()
    .single();

  if (error) throw error;
  return normalizeDeposit(data);
}

async function normalizeDeposit(row) {
  const normalized = {
    amount: Number(row.amount),
    walletAddress: row.wallet_address,
  };

  return {
    id: row.id,
    userId: row.user_id,
    amount: normalized.amount,
    walletAddress: normalized.walletAddress,
    qrCode: await createDepositQrCode(normalized),
    status: row.status,
    txHash: row.tx_hash,
    confirmations: row.confirmations || 0,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

async function findDeposit(depositId) {
  if (!isSupabaseConfigured) {
    return memoryDeposits.get(depositId) || null;
  }

  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('id', depositId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeDeposit(data) : null;
}

function scheduleDemoLifecycle(depositId) {
  if (!env.demoAutoConfirm) return;

  const stepMs = Math.max(env.demoConfirmSeconds * 1000, 6000) / (statusOrder.length - 1);

  statusOrder.slice(1).forEach((status, index) => {
    setTimeout(async () => {
      const deposit = await findDeposit(depositId);
      if (!deposit || deposit.status === 'completed' || deposit.status === 'expired') return;

      const patch = {
        status,
        confirmations: status === 'confirming' ? 6 : deposit.confirmations || 0,
        txHash: deposit.txHash,
      };

      if (status === 'completed') {
        patch.txHash = `DEMO_${depositId.replace(/-/g, '').slice(0, 20)}`;
        patch.confirmations = 19;
      }

      const updated = await updateDepositStatus(depositId, patch);

      if (updated?.status === 'completed') {
        await walletService.creditBalance({
          userId: updated.userId,
          amount: updated.amount,
          depositId: updated.id,
          txHash: updated.txHash,
        });
      }
    }, stepMs * (index + 1));
  });
}

async function createDeposit({ userId, amount }) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw createHttpError('Deposit amount must be greater than 0.');
  }

  if (numericAmount < 5) {
    throw createHttpError('Minimum deposit is 5 USDT.');
  }

  const id = `DEP_${uuidv4()}`;
  const walletAddress = assignDepositWallet(userId);
  const expiresAt = new Date(Date.now() + 1000 * 60 * env.depositExpiryMinutes).toISOString();
  const amountValue = Number(numericAmount.toFixed(6));
  const qrCode = await createDepositQrCode({ walletAddress, amount: amountValue });

  const deposit = await persistDeposit({
    id,
    userId: String(userId),
    amount: amountValue,
    walletAddress,
    qrCode,
    status: 'pending',
    confirmations: 0,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  scheduleDemoLifecycle(id);
  return deposit;
}

module.exports = {
  createDeposit,
  findDeposit,
  updateDepositStatus,
};
