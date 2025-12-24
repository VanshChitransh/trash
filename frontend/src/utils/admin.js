const ADMIN_EMAILS = [
  'vanshchitransh32@gmail.com',
  'arcinspectiongroup@gmail.com',
  'jitsingh7417@gmail.com',
  'test-user@gmail.com'
].map(email => email.toLowerCase());

export const isAdminEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

export const isAdminUser = (userOrEmail) => {
  const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email;
  return isAdminEmail(email);
};
