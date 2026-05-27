const asyncHandler = require('../utils/asyncHandler');
const walletService = require('../services/walletService');

const getBalance = asyncHandler(async (req, res) => {
  const balance = await walletService.getBalance(req.user.id);
  res.json({
    userId: req.user.id,
    asset: 'USDT',
    balance,
  });
});

const getHistory = asyncHandler(async (req, res) => {
  const transactions = await walletService.getHistory(req.user.id);
  res.json(transactions);
});

module.exports = {
  getBalance,
  getHistory,
};
