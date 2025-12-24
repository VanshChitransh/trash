const express = require('express');
const { startPayment, getStatus } = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.post('/start', protect, startPayment);
router.get('/status/:id?', protect, getStatus);

module.exports = router;
