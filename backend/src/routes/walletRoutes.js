const express = require('express');
const walletController = require('../controllers/walletController');

const router = express.Router();

router.get('/balance', walletController.getBalance);
router.get('/history', walletController.getHistory);

module.exports = router;
