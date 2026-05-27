const { TronWeb } = require('tronweb');
const env = require('../config/env');
const depositService = require('../services/depositService');
const walletService = require('../services/walletService');

function createTronWeb() {
  return new TronWeb({
    fullHost: env.tronFullHost,
    headers: env.tronGridApiKey ? { 'TRON-PRO-API-KEY': env.tronGridApiKey } : undefined,
  });
}

async function verifyUsdtTransfer({ depositId, txHash, to, amount, contractAddress, confirmations }) {
  const deposit = await depositService.findDeposit(depositId);
  if (!deposit) return { accepted: false, reason: 'deposit_not_found' };
  if (deposit.status === 'completed') return { accepted: false, reason: 'already_completed' };
  if (contractAddress !== env.usdtContract) return { accepted: false, reason: 'invalid_token_contract' };
  if (to !== deposit.walletAddress) return { accepted: false, reason: 'wallet_mismatch' };
  if (Number(amount) < Number(deposit.amount)) return { accepted: false, reason: 'amount_too_low' };
  if (Number(confirmations) < 12) return { accepted: false, reason: 'insufficient_confirmations' };

  const updated = await depositService.updateDepositStatus(depositId, {
    status: 'completed',
    txHash,
    confirmations,
  });

  await walletService.creditBalance({
    userId: updated.userId,
    amount: updated.amount,
    depositId: updated.id,
    txHash,
  });

  return { accepted: true, deposit: updated };
}

function startTronListener() {
  if (env.demoAutoConfirm) {
    console.log('TRON listener skipped in demo mode. Set DEMO_AUTO_CONFIRM=false for live verification.');
    return;
  }

  createTronWeb();
  console.log('TRON listener boundary initialized. Add TronGrid event polling before production use.');
}

module.exports = {
  startTronListener,
  verifyUsdtTransfer,
};
