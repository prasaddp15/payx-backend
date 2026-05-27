const { supabase, isSupabaseConfigured } = require('../config/supabase');

const memoryBalances = new Map([['101', 100]]);
const memoryTransactions = [
  {
    id: 'TXN_BOOTSTRAP',
    user_id: '101',
    type: 'bonus',
    amount: 100,
    status: 'completed',
    created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
  },
];

async function getBalance(userId) {
  if (!isSupabaseConfigured) {
    return Number(memoryBalances.get(String(userId)) || 0);
  }

  const { data, error } = await supabase
    .from('wallet_balances')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.balance || 0);
}

async function creditBalance({ userId, amount, depositId, txHash }) {
  if (!isSupabaseConfigured) {
    const current = await getBalance(userId);
    const next = Number((current + Number(amount)).toFixed(6));
    memoryBalances.set(String(userId), next);
    memoryTransactions.unshift({
      id: `TXN_${depositId}`,
      user_id: String(userId),
      type: 'deposit',
      amount: Number(amount),
      status: 'completed',
      tx_hash: txHash,
      created_at: new Date().toISOString(),
    });
    return next;
  }

  const { error: txError } = await supabase.from('transactions').insert({
    id: `TXN_${depositId}`,
    user_id: userId,
    type: 'deposit',
    amount,
    status: 'completed',
    tx_hash: txHash,
    deposit_id: depositId,
  });

  if (txError) throw txError;
  return getBalance(userId);
}

async function getHistory(userId) {
  if (!isSupabaseConfigured) {
    return memoryTransactions.filter((tx) => tx.user_id === String(userId));
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) throw error;
  return data || [];
}

module.exports = {
  getBalance,
  creditBalance,
  getHistory,
};
