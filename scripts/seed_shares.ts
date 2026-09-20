/**
 * Seed real share data for the Shares module end-to-end test.
 * Creates members, a share type, and issues shares so SharesView shows real DB data.
 * Run: npx tsx scripts/seed_shares.ts
 */
import 'dotenv/config';
import { getDb, closeDb } from '../src/db/client';
import { ShareService } from '../src/api/services/ShareService';
import { MemberService } from '../src/api/services/MemberService';
import { eq } from 'drizzle-orm';
import { members } from '../src/db/schema';

const ORG_ID = process.env.DEV_ORG_ID || '98f87866-0980-41b0-8f6e-47ab6e4dad82';
const BRANCH_ID = 'd3c27859-716f-4480-a908-58366294267c'; // DPSCO-HO

const SAMPLE_MEMBERS = [
  { fullName: 'Ram Bahadur Thapa', gender: 'Male', phone: '9841000001', dobBs: '2040-05-15', membershipDateBs: '2078-04-01' },
  { fullName: 'Sita Kumari Sharma', gender: 'Female', phone: '9841000002', dobBs: '2041-08-22', membershipDateBs: '2078-04-02' },
  { fullName: 'Hari Prasad Karki', gender: 'Male', phone: '9841000003', dobBs: '2039-11-30', membershipDateBs: '2078-04-05' },
  { fullName: 'Gita Devi Rana', gender: 'Female', phone: '9841000004', dobBs: '2042-02-10', membershipDateBs: '2078-05-11' },
  { fullName: 'Krishna Bahadur Gurung', gender: 'Male', phone: '9841000005', dobBs: '2038-01-01', membershipDateBs: '2078-05-20' },
];

async function main() {
  const db = getDb();
  if (!db) throw new Error('Database not connected');

  const memberService = new MemberService();
  const shareService = new ShareService();

  // 1. Create members if not already present
  const createdMembers: string[] = [];
  for (const m of SAMPLE_MEMBERS) {
    const existing = await db.select({ id: members.id }).from(members)
      .where(eq(members.phone, m.phone)).limit(1);
    if (existing.length > 0) {
      createdMembers.push(existing[0].id);
      console.log(`[seed] member exists: ${m.fullName} (${m.phone})`);
    } else {
      const member = await memberService.createMember(
        { ...m, branchId: BRANCH_ID },
        'DPSCO-HO',
        ORG_ID,
      );
      createdMembers.push(member.id);
      console.log(`[seed] created member: ${m.fullName} -> ${member.memberNo} (${member.id})`);
    }
  }

  // 2. Create an Ordinary share type if not present
  const types = await shareService.getTypes(ORG_ID);
  let ordType = types.find(t => t.code === 'ORD');
  if (!ordType) {
    ordType = await shareService.createType(ORG_ID, {
      code: 'ORD',
      name: 'Ordinary Shares',
      faceValue: 100,
      minShares: 10,
      maxAllowedKitta: 50000,
      isTransferable: true,
      dividendRate: 12,
      description: 'Standard ordinary share capital',
    });
    console.log(`[seed] created share type: ORD -> ${ordType.id}`);
  } else {
    console.log(`[seed] share type exists: ORD (${ordType.id})`);
  }

  // 3. Issue shares to each member
  const issueCounts = [20, 30, 15, 25, 10];
  for (let i = 0; i < createdMembers.length; i++) {
    const memberId = createdMembers[i];
    const holdings = await shareService.getHoldings(ORG_ID, { memberId, limit: 100 });
    if (holdings.total > 0) {
      console.log(`[seed] member ${memberId} already has holdings, skipping`);
      continue;
    }
    const result = await shareService.issueShares(
      ORG_ID,
      { memberId, shareTypeId: ordType.id, numberOfShares: issueCounts[i] },
      'seed-script',
    );
    console.log(`[seed] issued ${result.numberOfShares} shares -> ${result.memberName} (${result.certificateNo})`);
  }

  // 4. Summary
  const summary = await shareService.getSummary(ORG_ID);
  console.log('[seed] summary:', JSON.stringify(summary, null, 2));

  await closeDb();
  console.log('[seed] done');
}

main().catch(async (err) => {
  console.error('[seed] FAILED:', err.message || err);
  await closeDb();
  process.exit(1);
});
