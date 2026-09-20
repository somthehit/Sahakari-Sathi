import 'dotenv/config';
import { getDb } from '../src/db/client';
import { initChequeTables } from '../src/db/initChequeTables';
import { chequeSettings, chequeBooks, chequeLeaves, chequeStopPayments, chequeBounces, organizations, savingsAccounts, savingsProducts, branches } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';

async function testChequeFlow() {
  console.log('=== TESTING CHEQUE SETTINGS & MANAGEMENT ENGINE ===');
  await initChequeTables();
  const db = getDb();

  if (!db) {
    console.error('❌ Database not connected.');
    process.exit(1);
  }

  // 1. Get or create mock test org
  let [org] = await db.select().from(organizations).limit(1);
  if (!org) {
    [org] = await db.insert(organizations).values({
      organizationName: 'Test Cooperative',
      organizationCode: 'TESTORG',
    }).returning();
  }
  console.log('✅ Using Organization:', org.organizationName, '(', org.id, ')');

  // 2. Query cheque_settings table
  const [settings] = await db.select().from(chequeSettings).where(eq(chequeSettings.organizationId, org.id)).limit(1);
  console.log('✅ Cheque Settings Query:', settings ? 'Found existing config' : 'None yet (will use default)');

  // 3. Test Inserting / Updating cheque_settings
  const [upserted] = await db.insert(chequeSettings).values({
    organizationId: org.id,
    scope: 'organization',
    enableChequeFacility: true,
    defaultLeavesPerBook: 25,
    allowedBookSizes: [10, 20, 25, 50, 100],
    maxActiveBooksPerAccount: 2,
    startingChequeNumber: 200001,
    chequePrefix: 'CHQ-',
    numberLength: 6,
    validityPeriodDays: 90,
    stopPaymentCharge: '100.00',
    bounceCharge: '250.00',
    issuanceChargeAmount: '50.00',
  }).onConflictDoNothing().returning();

  console.log('✅ Cheque Settings Upsert Check:', upserted ? 'Inserted new record' : 'Record already present');

  // 4. Verify cheque_books & cheque_leaves tables exist and are queryable
  const booksCount = await db.select().from(chequeBooks).where(eq(chequeBooks.organizationId, org.id));
  const leavesCount = await db.select().from(chequeLeaves).where(eq(chequeLeaves.organizationId, org.id));
  const stopCount = await db.select().from(chequeStopPayments).where(eq(chequeStopPayments.organizationId, org.id));
  const bounceCount = await db.select().from(chequeBounces).where(eq(chequeBounces.organizationId, org.id));

  console.log(`✅ Table queries successful!`);
  console.log(`   - Cheque Books count: ${booksCount.length}`);
  console.log(`   - Cheque Leaves count: ${leavesCount.length}`);
  console.log(`   - Stop Payments count: ${stopCount.length}`);
  console.log(`   - Bounced Cheques count: ${bounceCount.length}`);

  console.log('=== ALL DATABASE TABLES & SCHEMA VERIFIED SUCCESSFULLY ===');
  process.exit(0);
}

testChequeFlow().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
