const ADMIN_EMAILS = [
  'vanshchitransh32@gmail.com',
  'arcinspectiongroup@gmail.com',
  'jitsingh7417@gmail.com',
  'evolvingbytesm@gmail.com',
  'test-user@gmail.com'
].map(email => email.toLowerCase());

const isAdminEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

module.exports = {
  ADMIN_EMAILS,
  isAdminEmail,
};
