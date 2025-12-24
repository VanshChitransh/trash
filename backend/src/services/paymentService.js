const { randomUUID } = require('crypto');
const prisma = require('../lib/prisma');

const PAYMENT_LINKS = {
  // Use the actual $39 link by default; env overrides still supported
  '39': process.env.PAYLINK_39 || 'https://062d7c99-88ba-494f-9fee-053ef250b120.paylinks.godaddy.com/20cf3d00-16c8-42f1-b243-d57',
  '89': process.env.PAYLINK_89 || 'https://062d7c99-88ba-494f-9fee-053ef250b120.paylinks.godaddy.com/estimates',
  // Keep a separate key if a trial link is still needed in the future
  '39_trial': process.env.PAYLINK_39_TRIAL || 'https://062d7c99-88ba-494f-9fee-053ef250b120.paylinks.godaddy.com/trial',
};

const AMOUNT_CENTS = {
  '39': 3900,
  '89': 8900,
  // Optional $1 tier if you want to address it explicitly later
  '1': 100,
};

const PAYMENT_TTL_MS = 2 * 60 * 1000; // 2 minutes to complete payment

const createPayment = async ({ userId, fileId = null, amountTier }) => {
  if (!AMOUNT_CENTS[amountTier]) {
    throw new Error('Unsupported amount tier');
  }

  // Use built-in UUID generation to avoid ESM require issues
  const correlationToken = randomUUID();
  const expiresAt = new Date(Date.now() + PAYMENT_TTL_MS);

  const payment = await prisma.payment.create({
    data: {
      userId,
      fileId,
      amountTier,
      amountCents: AMOUNT_CENTS[amountTier],
      status: 'PENDING',
      paylinkUrl: PAYMENT_LINKS[amountTier],
      correlationToken,
      expiresAt,
    },
  });

  return payment;
};

const getPaymentById = async (paymentId, userId) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment || payment.userId !== userId) {
    return null;
  }
  return payment;
};

const markPaymentStatus = async (paymentId, status, metadata = {}) => {
  return prisma.payment.update({
    where: { id: paymentId },
    data: {
      status,
      emailMessageId: metadata.emailMessageId || null,
      payerEmail: metadata.payerEmail || null,
      matchedAt: metadata.matchedAt || (status === 'PAID' ? new Date() : null),
      updatedAt: new Date(),
    },
  });
};

const expireStalePayments = async () => {
  const now = new Date();
  await prisma.payment.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: now },
    },
    data: {
      status: 'EXPIRED',
      updatedAt: now,
    },
  });
};

module.exports = {
  createPayment,
  getPaymentById,
  markPaymentStatus,
  expireStalePayments,
  PAYMENT_LINKS,
  PAYMENT_TTL_MS,
};
