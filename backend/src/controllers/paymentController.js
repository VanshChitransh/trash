const {
  createPayment,
  getPaymentById,
  expireStalePayments,
  PAYMENT_LINKS,
} = require('../services/paymentService');
const { verifyPaymentViaPython } = require('../services/pythonPaymentVerifier');

const startPayment = async (req, res) => {
  try {
    const { amountTier, fileId = null } = req.body || {};
    if (!amountTier) {
      return res.status(400).json({ success: false, message: 'amountTier is required' });
    }

    await expireStalePayments();

    const payment = await createPayment({
      userId: req.user.id,
      fileId,
      amountTier,
    });

    // Run Python-based verifier (non-blocking)
    verifyPaymentViaPython(payment).catch((err) => {
      console.error('Python payment verifier error:', err.message);
    });

    // If the paylink supports query params, append correlation token (best effort)
    const separator = PAYMENT_LINKS[amountTier].includes('?') ? '&' : '?';
    const redirectUrl = `${PAYMENT_LINKS[amountTier]}${separator}session=${payment.id}`;

    return res.status(201).json({
      success: true,
      data: {
        paymentId: payment.id,
        redirectUrl,
        expiresAt: payment.expiresAt,
      },
    });
  } catch (error) {
    console.error('startPayment error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to start payment' });
  }
};

const getStatus = async (req, res) => {
  try {
    const paymentId = req.params.id || req.query.paymentId;
    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'paymentId is required' });
    }

    await expireStalePayments();
    const payment = await getPaymentById(paymentId, req.user.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        paymentId: payment.id,
        status: payment.status,
        amountTier: payment.amountTier,
        amountCents: payment.amountCents,
        updatedAt: payment.updatedAt,
        expiresAt: payment.expiresAt,
      },
    });
  } catch (error) {
    console.error('getStatus error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to get payment status' });
  }
};

module.exports = {
  startPayment,
  getStatus,
};
