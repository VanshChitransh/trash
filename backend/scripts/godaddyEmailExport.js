/**
 * Export recent GoDaddy-related emails to markdown (summary + per-email files).
 * Filters by allowed senders (GoDaddy + vanshchitransh32@gmail.com).
 */

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const fs = require('fs/promises');
const path = require('path');

// --- Configuration ---------------------------------------------------------

// Gmail IMAP credentials
const GMAIL_USER = process.env.GMAIL_USER || 'arcinspectiongroup@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD; // <- required
const GMAIL_HOST = process.env.GMAIL_IMAP_HOST || 'imap.gmail.com';
const GMAIL_PORT = parseInt(process.env.GMAIL_IMAP_PORT || '993', 10);

// Allowed senders (comma-separated env or default list)
const ALLOWED_SENDERS = (
  process.env.PAYMENT_EMAIL_SENDERS ||
  'donotreply@email.payments.godaddy.com,vanshchitransh32@gmail.com'
)
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Time window (in hours) to look back, if not disabled
const TIME_WINDOW_HOURS = parseInt(
  process.env.GODADDY_PAYMENTS_WINDOW_HOURS || '2',
  10
);

// Disable time filtering? (like your PAYMENT_EMAIL_DISABLE_TIME_FILTER)
const DISABLE_TIME_FILTER =
  String(process.env.PAYMENT_EMAIL_DISABLE_TIME_FILTER || '').toLowerCase() ===
  'true';

// Maximum number of emails to inspect
const MAX_EMAILS = parseInt(
  process.env.GODADDY_PAYMENTS_MAX ||
    process.env.PAYMENT_EMAIL_MAX ||
    '10',
  10
);

// Output locations
const SUMMARY_FILE = path.join(process.cwd(), 'godaddy_payments_summary.md');
const EMAIL_DIR = path.join(process.cwd(), 'godaddy_emails');

// --------------------------------------------------------------------------

// Basic env check
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error(
    '❌ Missing GMAIL_USER or GMAIL_APP_PASSWORD. Set them in your environment.'
  );
  process.exit(1);
}

// Connect IMAP client
const connectClient = async () => {
  const client = new ImapFlow({
    host: GMAIL_HOST,
    port: GMAIL_PORT,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  console.log('📩 Connecting to Gmail...');
  await client.connect();
  return client;
};

// Prefer text, fall back to stripped HTML
const decodeBody = (parsed) => {
  if (parsed.text && parsed.text.trim()) return parsed.text.trim();
  if (parsed.html) {
    return parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return '';
};

const sanitizeFilename = (name) =>
  name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'email';

const ensureDir = async (dir) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
};

// Write a summary markdown file with all collected emails
const writeSummary = async (emails) => {
  let md = `# GoDaddy Payments / Related Emails\n\n`;
  md += `_Allowed senders: ${ALLOWED_SENDERS.join(', ')}_\n\n`;
  if (DISABLE_TIME_FILTER) {
    md += `_Time filter: disabled (last ${MAX_EMAILS} messages only)_\n\n`;
  } else {
    md += `_Time window: last ${TIME_WINDOW_HOURS} hours_\n\n`;
  }
  md += `_Generated on ${new Date().toISOString()}_\n\n`;
  md += `---\n\n`;

  for (const email of emails) {
    md += `## ${email.subject || '(No Subject)'}\n\n`;
    md += `- **From:** \`${email.from}\`\n`;
    md += `- **Date:** \`${email.date || ''}\`\n\n`;
    md += '```text\n';
    md += email.bodyForFile;
    md += '\n```\n\n---\n\n';
  }

  await fs.writeFile(SUMMARY_FILE, md, 'utf8');
  console.log(`📁 Summary written to: ${SUMMARY_FILE}`);
};

// Write each email into its own markdown file
const writeEmailFiles = async (emails) => {
  await ensureDir(EMAIL_DIR);

  for (const email of emails) {
    const safeSubject = sanitizeFilename(email.subject || 'email');
    const ts = email.dateIso || Date.now();
    const filename = path.join(
      EMAIL_DIR,
      `${safeSubject}_${ts}.md`.replace(/[:]/g, '-')
    );

    let md = `# ${email.subject || '(No Subject)'}\n\n`;
    md += `- **From:** \`${email.from}\`\n`;
    md += `- **Date:** \`${email.date || ''}\`\n\n`;
    md += '```text\n';
    md += email.bodyFull;
    md += '\n```\n';

    await fs.writeFile(filename, md, 'utf8');
    console.log(`📄 Saved email → ${filename}`);
  }

  console.log(`📁 Saved ${emails.length} emails to: ${EMAIL_DIR}`);
};

// Main script
const main = async () => {
  const client = await connectClient();
  const since = new Date(Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000);
  const collected = [];

  try {
    await client.mailboxOpen('INBOX');

    let uids;

    if (DISABLE_TIME_FILTER) {
      // 🔄 Just take the last MAX_EMAILS messages, like your Python script behavior
      const mailbox = await client.status('INBOX', { messages: true, uidnext: true });
      const lastUid = (mailbox.uidnext || 1) - 1;
      const startUid = Math.max(1, lastUid - MAX_EMAILS + 1);
      uids = Array.from({ length: lastUid - startUid + 1 }, (_, i) => startUid + i);
      console.log(
        `Time filter disabled; inspecting last ${uids.length} messages (allowed senders: ${ALLOWED_SENDERS.join(
          ', '
        )})`
      );
    } else {
      // 🔍 Search by date only; we’ll filter senders in app layer
      uids = await client.search({ since });

      if (!uids || uids.length === 0) {
        const mailbox = await client.status('INBOX', {
          messages: true,
          uidnext: true,
        });
        const lastUid = (mailbox.uidnext || 1) - 1;
        const startUid = Math.max(1, lastUid - MAX_EMAILS + 1);
        uids = Array.from(
          { length: lastUid - startUid + 1 },
          (_, i) => startUid + i
        );
        console.log(
          'No matches in filtered search; falling back to last messages in INBOX.'
        );
      }

      uids = uids.slice(-MAX_EMAILS).reverse();
      console.log(
        `Inspecting ${uids.length} messages (allowed senders: ${ALLOWED_SENDERS.join(
          ', '
        )}, window: ${TIME_WINDOW_HOURS}h)`
      );
    }

    // Newest first if not already
    if (!DISABLE_TIME_FILTER) {
      uids = uids.slice(-MAX_EMAILS).reverse();
    }

    for (const uid of uids) {
      try {
        for await (const message of client.fetch(
          { uid },
          { source: true, envelope: true }
        )) {
          if (!message.source || message.source.length === 0) continue;

          let parsed;
          try {
            parsed = await simpleParser(message.source);
          } catch (err) {
            console.error(`Parse failed for UID ${uid}: ${err.message}`);
            continue;
          }

          const fromRaw = (parsed.from?.text || '').toLowerCase();
          const isAllowed = ALLOWED_SENDERS.some((sender) =>
            fromRaw.includes(sender)
          );

          if (!isAllowed) {
            console.log(
              `Skipping UID ${uid} from non-allowed sender: ${parsed.from?.text || ''}`
            );
            continue;
          }

          const body = decodeBody(parsed);
          const dateObj = parsed.date ? new Date(parsed.date) : null;
          const dateIso = dateObj ? dateObj.toISOString() : '';
          const bodyForFile =
            body.length > 4000 ? `${body.slice(0, 4000)}\n\n...[truncated]...` : body;

          console.log('='.repeat(70));
          console.log(`UID: ${uid}`);
          console.log(`From: ${parsed.from?.text || ''}`);
          console.log(`Subject: ${parsed.subject || ''}`);
          console.log(`Date: ${parsed.date || ''}`);
          console.log('-'.repeat(70));
          console.log(
            body.slice(0, 600) + (body.length > 600 ? '\n...[truncated]...' : '')
          );
          console.log('='.repeat(70));

          collected.push({
            uid,
            from: parsed.from?.text || '',
            subject: parsed.subject || '',
            date: parsed.date || '',
            dateIso,
            bodyFull: body || '[No readable text]',
            bodyForFile: bodyForFile || '[No readable text]',
          });
        }
      } catch (err) {
        console.error(`Error fetching UID ${uid}: ${err.message}`);
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }

  if (collected.length === 0) {
    console.log('No emails collected from allowed senders.');
    return;
  }

  await writeSummary(collected);
  await writeEmailFiles(collected);
};

// Run
main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
