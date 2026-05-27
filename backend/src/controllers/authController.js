const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.user.id);
  res.json({
    user: req.user,
    profile,
  });
});

module.exports = {
  register,
  login,
  me,
};
