/**
 * One-time migration: removes mock/seed members that were inserted by seed.ts.
 * These are identifiable by their sequential member numbers MBR-2083-0001 to MBR-2083-0010.
 *
 * Run once with: npx tsx migrate_remove_mock_members.ts
 */
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { getDb } from './src/db/client';
import {
  members,
  memberKycProfiles,
  memberFinancialProfiles,
  memberFamily,
  memberBiometrics,
  memberPortalSettings,
  memberDocuments,
} from './src/db/schema';

const MOCK_MEMBER_NOS = [
  'MBR-2083-0001',
  'MBR-2083-0002',
  'MBR-2083-0003',
  'MBR-2083-0004',
  'MBR-2083-0005',
  'MBR-2083-0006',
  'MBR-2083-0007',
  'MBR-2083-0008',
  'MBR-2083-0009',
  'MBR-2083-0010',
];

async function removeMockMembers() {
  const db = getDb();
  if (!db) {
    console.error('❌ Database not connected.');
    process.exit(1);
  }

  // Find mock member IDs
  const mockRows = await db
    .select({ id: members.id, memberNo: members.memberNo, fullName: members.fullName })
    .from(members)
    .where(inArray(members.memberNo, MOCK_MEMBER_NOS));

  if (mockRows.length === 0) {
    console.log('✅ No mock members found — nothing to delete.');
    return;
  }

  console.log(`Found ${mockRows.length} mock member(s) to delete:`);
  mockRows.forEach(m => console.log(`  → ${m.memberNo}  ${m.fullName}  (${m.id})`));

  const ids = mockRows.map(m => m.id);

  // Delete child records first (FK constraints), then the parent
  await db.delete(memberDocuments).where(inArray(memberDocuments.memberId, ids));
  await db.delete(memberBiometrics).where(inArray(memberBiometrics.memberId, ids));
  await db.delete(memberPortalSettings).where(inArray(memberPortalSettings.memberId, ids));
  await db.delete(memberFamily).where(inArray(memberFamily.memberId, ids));
  await db.delete(memberFinancialProfiles).where(inArray(memberFinancialProfiles.memberId, ids));
  await db.delete(memberKycProfiles).where(inArray(memberKycProfiles.memberId, ids));
  await db.delete(members).where(inArray(members.id, ids));

  console.log(`✅ Deleted ${mockRows.length} mock member(s) and all their child records.`);
}

removeMockMembers().then(() => process.exit(0)).catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
