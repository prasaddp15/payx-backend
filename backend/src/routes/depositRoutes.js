const express = require('express');
const depositController = require('../controllers/depositController');

const router = express.Router();

router.post('/create', depositController.createDeposit);
router.get('/:id', depositController.getDeposit);

module.exports = router;
