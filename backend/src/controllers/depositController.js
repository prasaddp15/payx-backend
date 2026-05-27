const asyncHandler = require('../utils/asyncHandler');
const depositService = require('../services/depositService');

const createDeposit = asyncHandler(async (req, res) => {
  const deposit = await depositService.createDeposit({
    userId: req.user.id,
    amount: req.body.amount,
  });

  res.status(201).json(deposit);
});

const getDeposit = asyncHandler(async (req, res) => {
  const deposit = await depositService.findDeposit(req.params.id);

  if (!deposit) {
    return res.status(404).json({ message: 'Deposit not found.' });
  }

  if (String(deposit.userId) !== String(req.user.id)) {
    return res.status(403).json({ message: 'This deposit does not belong to the authenticated user.' });
  }

  res.json(deposit);
});

module.exports = {
  createDeposit,
  getDeposit,
};
