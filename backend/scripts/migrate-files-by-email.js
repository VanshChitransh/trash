/**
 * Migration Script: Migrate Files Between User Accounts by Email
 * 
 * This script helps move files from one user account to another
 * when the same email has different user IDs in different databases.
 * 
 * Usage:
 *   node scripts/migrate-files-by-email.js <sourceEmail> <targetEmail>
 * 
 * Example:
 *   node scripts/migrate-files-by-email.js user@example.com user@example.com
 * 
 * WARNING: This script modifies your database. Use with caution!
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateFilesByEmail(sourceEmail, targetEmail) {
  try {
    console.log(`\n🔍 Searching for users...`);
    
    // Find source user (where files currently are)
    const sourceUser = await prisma.user.findUnique({
      where: { email: sourceEmail.toLowerCase() },
      include: {
        pdfUploads: true,
        estimates: true,
      },
    });
    
    if (!sourceUser) {
      console.error(`❌ Source user not found: ${sourceEmail}`);
      return;
    }
    
    console.log(`✅ Found source user: ${sourceUser.id} (${sourceUser.email})`);
    console.log(`   - Files: ${sourceUser.pdfUploads.length}`);
    console.log(`   - Estimates: ${sourceUser.estimates.length}`);
    
    // Find target user (where files should be moved to)
    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail.toLowerCase() },
    });
    
    if (!targetUser) {
      console.error(`❌ Target user not found: ${targetEmail}`);
      console.log(`💡 Tip: The target user must exist. Create it first by logging in.`);
      return;
    }
    
    console.log(`✅ Found target user: ${targetUser.id} (${targetUser.email})`);
    
    // Check if source and target are the same
    if (sourceUser.id === targetUser.id) {
      console.log(`\n✅ Users are the same. No migration needed.`);
      return;
    }
    
    // Confirm migration
    console.log(`\n⚠️  WARNING: This will move ${sourceUser.pdfUploads.length} files and ${sourceUser.estimates.length} estimates`);
    console.log(`   from user ${sourceUser.id} to user ${targetUser.id}`);
    console.log(`\nPress Ctrl+C to cancel, or wait 5 seconds to continue...`);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Migrate PDF uploads
    console.log(`\n📦 Migrating PDF uploads...`);
    const pdfResult = await prisma.pdfUpload.updateMany({
      where: { userId: sourceUser.id },
      data: { userId: targetUser.id },
    });
    console.log(`✅ Migrated ${pdfResult.count} PDF uploads`);
    
    // Migrate estimates
    console.log(`\n📊 Migrating estimates...`);
    const estimateResult = await prisma.estimate.updateMany({
      where: { userId: sourceUser.id },
      data: { userId: targetUser.id },
    });
    console.log(`✅ Migrated ${estimateResult.count} estimates`);
    
    // Update account links if needed (for Google OAuth)
    console.log(`\n🔗 Checking account links...`);
    const accountResult = await prisma.account.updateMany({
      where: { userId: sourceUser.id },
      data: { userId: targetUser.id },
    });
    console.log(`✅ Updated ${accountResult.count} account links`);
    
    console.log(`\n✅ Migration completed successfully!`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Log in with ${targetEmail} on your production site`);
    console.log(`   2. Verify that all files are visible`);
    console.log(`   3. Optionally delete the old user account: ${sourceUser.id}`);
    
  } catch (error) {
    console.error(`\n❌ Migration failed:`, error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`\n❌ Usage: node scripts/migrate-files-by-email.js <sourceEmail> <targetEmail>`);
  console.log(`\nExample:`);
  console.log(`   node scripts/migrate-files-by-email.js user@example.com user@example.com`);
  console.log(`\nThis script migrates files from one user account to another by email.`);
  console.log(`Useful when the same email has different user IDs in different databases.`);
  process.exit(1);
}

const [sourceEmail, targetEmail] = args;

// Run migration
migrateFilesByEmail(sourceEmail, targetEmail)
  .then(() => {
    console.log(`\n✅ Script completed`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ Script failed:`, error);
    process.exit(1);
  });

