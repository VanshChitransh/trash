const { spawn } = require('child_process');
const path = require('path');
const { markPaymentStatus } = require('./paymentService');

// rough.py lives at repository root (../../../../rough.py from this file)
const PYTHON_FILE = path.resolve(__dirname, '../../../../rough.py');

// Run the existing Python script and parse stdout for payment detections
const runPythonPaymentCheck = () =>
  new Promise((resolve, reject) => {
    const child = spawn('python3', [PYTHON_FILE], {
      env: {
        ...process.env,
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || `Python exited with code ${code}`));
      }
      resolve(stdout);
    });
  });

// Extract the last payment detection from rough.py output
const parsePaymentFromOutput = (output) => {
  // Matches lines like: "✅ Payment email detected: ...\n   → Payer: email, Amount: 39.0"
  const matches = [...output.matchAll(/Payment email detected:.*?\n\s*→ Payer:\s*([^\s,]+),\s*Amount:\s*([0-9.]+)/gi)];
  if (!matches.length) return null;
  const [, payerEmail, amountStr] = matches[matches.length - 1];
  const amount = parseFloat(amountStr);
  return { payerEmail, amount };
};

// Public: launch Python, parse payment, and optionally mark DB
const verifyPaymentViaPython = async (payment) => {
  try {
    const output = await runPythonPaymentCheck();
    const parsed = parsePaymentFromOutput(output);
    if (!parsed) {
      console.log('[python-verifier] No payment emails detected');
      return false;
    }

    console.log('[python-verifier] Payment detected:', parsed);

    await markPaymentStatus(payment.id, 'PAID', {
      payerEmail: parsed.payerEmail,
      matchedAt: new Date(),
    });

    return true;
  } catch (err) {
    console.error('[python-verifier] Error:', err.message);
    return false;
  }
};

module.exports = {
  verifyPaymentViaPython,
};
