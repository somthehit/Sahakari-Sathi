/**
 * Database Seed Script
 * Migrates all mockData into PostgreSQL via Drizzle ORM
 * Run: npx tsx src/db/seed.ts
 */
import 'dotenv/config';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { eq, and } from 'drizzle-orm';
import { getDb } from './client';
import {
  branches, members, memberKycProfiles, memberFinancialProfiles,
  memberFamily, memberPortalSettings, memberBiometrics,
  memberTypes, memberCategories,
  savingsAccounts,
  savingsTransactions, loanAccounts, emiSchedules,
  shareHoldings, chartOfAccounts, vouchers, voucherEntries,
  collectionRoutes, budgetLines,
  fixedAssets, approvalRequests, auditLogs, customerTickets,
  superAdmins, organizations, departments, designations, roles, orgUsers,
  organizationProfiles, organizationSubscriptions, organizationLimits,
  provinces, districts, municipalities, wards
} from './schema';
import { NEPAL_PROVINCES } from '../data/nepalGeo';
import nepalLocalUnits from '../data/nepalLocalUnits.json';
import {
  INITIAL_BRANCHES, INITIAL_MEMBERS,
  INITIAL_SAVINGS_ACCOUNTS, INITIAL_LOAN_ACCOUNTS,
  INITIAL_CHART_OF_ACCOUNTS, INITIAL_VOUCHERS,
  INITIAL_COLLECTION_ROUTES, INITIAL_BUDGET_LINES,
  INITIAL_FIXED_ASSETS,
  INITIAL_APPROVAL_REQUESTS, INITIAL_AUDIT_LOGS, INITIAL_TICKETS
} from '../data/mockData';

/**
 * Helper to convert mock string IDs (like 'b1', 'm1') into valid deterministic UUIDs
 * required by PostgreSQL for uuid columns.
 */
function toUuid(id: string | null | undefined): string | any {
  if (!id) return id;
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`;
}

async function seed() {
  const db = getDb();
  if (!db) {
    console.error('[Seed] ❌ DATABASE_URL not set. Cannot seed.');
    process.exit(1);
  }

  console.log('[Seed] Starting database seed from mockData...');

  try {
    // 0. Auth & RBAC
    console.log('[Seed] → Seeding Super Admin & RBAC...');
    const superAdminEmail = 'superadmin@system.sahakarisathi.internal';
    const superAdminPassword = 'admin123';
    let superAdminAuthUid = 'seeded-superadmin-uid';

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        console.log(`[Seed] → Registering Supabase Auth user for Super Admin (${superAdminEmail})...`);
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data, error } = await supabase.auth.admin.createUser({
          email: superAdminEmail,
          password: superAdminPassword,
          email_confirm: true,
        });
        if (error && error.message.includes('already')) {
          console.log(`[Seed] ✅ Supabase Auth user already exists for Super Admin.`);
          const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
          if (!listError && usersData?.users) {
            const existing = usersData.users.find((u: any) => u.email === superAdminEmail);
            if (existing) superAdminAuthUid = existing.id;
          }
        } else if (data?.user) {
          superAdminAuthUid = data.user.id;
          console.log(`[Seed] ✅ Supabase Auth user created for Super Admin. UID: ${superAdminAuthUid}`);
        }
      } catch (err) {
        console.warn('[Seed] ⚠️ Could not reach Supabase API for Super Admin, using fallback UID:', err);
      }
    }

    await db.insert(superAdmins).values({
      id: toUuid('sa1'),
      authUserId: superAdminAuthUid,
      username: 'superadmin',
      email: 'superadmin@sahakarisathi.com',
      fullName: 'System Super Admin',
      status: 'Active',
      updatedAt: new Date(),
    }).onConflictDoNothing();

    if (superAdminAuthUid !== 'seeded-superadmin-uid') {
      await db.update(superAdmins)
        .set({ authUserId: superAdminAuthUid, updatedAt: new Date() })
        .where(eq(superAdmins.username, 'superadmin'));
    }

    const [org] = await db.insert(organizations).values({
      id: toUuid('org1'),
      organizationCode: 'SOFTLAB',
      organizationName: 'Softlab Solutions Pvt. Ltd.',
      shortName: 'Softlab',
      status: 'Active',
    }).returning().onConflictDoNothing();

    const softlabOrg = org || (await db.query.organizations.findFirst({
      where: (orgs, { eq }) => eq(orgs.organizationCode, 'SOFTLAB')
    }));

    if (softlabOrg) {
      await db.insert(organizationProfiles).values({ organizationId: softlabOrg.id }).onConflictDoNothing();
      await db.insert(organizationSubscriptions).values({ organizationId: softlabOrg.id }).onConflictDoNothing();
      await db.insert(organizationLimits).values({ organizationId: softlabOrg.id }).onConflictDoNothing();

      const [itDept] = await db.insert(departments).values({
        id: toUuid('dept1'), organizationId: softlabOrg.id, name: 'Information Technology'
      }).returning().onConflictDoNothing();
      const [mgmtDept] = await db.insert(departments).values({
        id: toUuid('dept2'), organizationId: softlabOrg.id, name: 'Management'
      }).returning().onConflictDoNothing();

      const itDeptId = itDept?.id || toUuid('dept1');
      const mgmtDeptId = mgmtDept?.id || toUuid('dept2');

      await db.insert(designations).values([
        { id: toUuid('desg1'), departmentId: itDeptId, name: 'System Administrator' },
        { id: toUuid('desg2'), departmentId: mgmtDeptId, name: 'General Manager' },
      ]).onConflictDoNothing();

      const [superAdminRole] = await db.insert(roles).values([
        { id: toUuid('role1'), organizationId: softlabOrg.id, code: 'SUP', name: 'Super Admin', nameNepali: 'सुपर एडमिन', description: 'Platform/system super admin', permissions: JSON.stringify(['*']), isSystem: true, sortOrder: 1 },
        { id: toUuid('role2'), organizationId: softlabOrg.id, code: 'MGR', name: 'Branch Manager', nameNepali: 'शाखा प्रबन्धक', description: 'Manages a branch end-to-end', permissions: JSON.stringify(['view_dashboard', 'manage_users']), isSystem: true, sortOrder: 2 },
        { id: toUuid('role3'), organizationId: softlabOrg.id, code: 'TLR', name: 'Teller', nameNepali: 'टेलर', description: 'Processes counter transactions', permissions: JSON.stringify(['process_transactions']), isSystem: true, sortOrder: 3 },
      ]).returning().onConflictDoNothing();

      const role1Id = superAdminRole?.id || toUuid('role1');

      // 0.1 Seed Supabase Auth & orgUser for SOFTLAB admin
      const syntheticEmail = 'admin@softlab.sahakarisathi.internal';
      const defaultPassword = 'admin123';
      let authUid = 'seeded-admin-uid';

      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          console.log(`[Seed] → Registering Supabase Auth user for ${syntheticEmail}...`);
          const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
          const { data, error } = await supabase.auth.admin.createUser({
            email: syntheticEmail,
            password: defaultPassword,
            email_confirm: true,
          });
          if (error && error.message.includes('already')) {
            console.log(`[Seed] ✅ Supabase Auth user already exists.`);
            // Fetch the existing user
            const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
            if (!listError && usersData?.users) {
                const existing = usersData.users.find((u: any) => u.email === syntheticEmail);
                if (existing) authUid = existing.id;
            }
          } else if (data?.user) {
            authUid = data.user.id;
            console.log(`[Seed] ✅ Supabase Auth user created. UID: ${authUid}`);
          }
        } catch (err) {
          console.warn('[Seed] ⚠️ Could not reach Supabase API, using fallback UID:', err);
        }
      }

      await db.insert(orgUsers).values({
        id: toUuid('user1'),
        organizationId: softlabOrg.id,
        username: 'admin',
        email: 'admin@softlab.com',
        authUserId: authUid,
        requiresPasswordChange: false,
        isTemporaryPassword: false,
        temporaryPassword: false,
        securityScore: 100,
        securitySetupCompleted: true,
        mobileVerified: true,
        securityQuestionsCompleted: true,
        passwordChanged: true,
        firstLoginCompleted: true,
        roleId: role1Id,
        status: 'Active',
      }).onConflictDoNothing();

      // Keep auth_user_id in sync with the real Supabase auth user so
      // token verification (findUserByAuthId) works on reseeds.
      if (authUid !== 'seeded-admin-uid') {
        await db.update(orgUsers)
          .set({ authUserId: authUid })
          .where(eq(orgUsers.username, 'admin'));
      }
    }

    // 0.5 Nepal Administrative Master Data (7 provinces + 77 districts)
    console.log('[Seed] → Seeding Nepal provinces & districts...');
    let provincesSeeded = 0;
    let districtsSeeded = 0;
    for (const p of NEPAL_PROVINCES) {
      const [prov] = await db.insert(provinces).values({
        code: p.code,
        name: p.name,
        nameNepali: p.nameNepali,
      }).returning({ id: provinces.id }).onConflictDoNothing();

      const provId = prov?.id ?? (await db.query.provinces.findFirst({
        where: (pr, { eq }) => eq(pr.code, p.code),
      }))?.id;

      if (!provId) {
        console.warn(`[Seed] ⚠️ Could not resolve province ${p.name} (${p.code})`);
        continue;
      }

      if (prov) provincesSeeded++;

      for (const d of p.districts) {
        await db.insert(districts).values({
          provinceId: provId,
          code: d.code,
          name: d.name,
          nameNepali: d.nameNepali,
        }).onConflictDoNothing();
        districtsSeeded++;
      }
    }
    console.log(`[Seed] → Provinces: ${provincesSeeded} new, Districts: ${districtsSeeded} (upsert-safe)`);

    // 0.6 Nepal Municipalities (753) + Wards
    console.log('[Seed] → Seeding Nepal municipalities & wards...');

    const LOCAL_UNIT_PROVINCE_KEYS: Record<string, string> = {
      'Koshi Province': '1',
      'Madesh Province': '2',
      'Bagmati Province': '3',
      'Gandaki Province': '4',
      'Lumbini Province': '5',
      'Karnali Province': '6',
      'Sudurpaschim Province': '7',
    };

    const detectMuniType = (rawName: string): string => {
      const n = rawName.toLowerCase();
      if (n.includes('rural')) return 'Rural Municipality';
      if (n.includes('sub-metro')) return 'Sub-Metropolitan City';
      if (n.includes('metropolitan')) return 'Metropolitan City';
      return 'Municipality';
    };

    const existingWardKeys = new Set(
      (await db.select({ m: wards.municipalityId, w: wards.wardNo }).from(wards))
        .map((r) => `${r.m}:${r.w}`),
    );

    let municipalitiesUpserted = 0;
    let wardsSeeded = 0;

    const DISTRICT_KEY_ALIASES: Record<string, string> = {
      Dhanusa: 'Dhanusha',
      Manag: 'Manang',
      'Nawalparasi East': 'Nawalpur',
      Tanahu: 'Tanahun',
      'Rukum East': 'Eastern Rukum',
      Kapilbastu: 'Kapilvastu',
      'Nawalparasi (Bardaghat Susta West)': 'Parasi',
      'Rukum West': 'Western Rukum',
    };

    for (const p of NEPAL_PROVINCES) {
      const jsonProvince = Object.entries(nepalLocalUnits)
        .find(([key]) => LOCAL_UNIT_PROVINCE_KEYS[key] === p.code)?.[1];
      if (!jsonProvince) {
        console.warn(`[Seed] ⚠️ No local units found for province ${p.name}`);
        continue;
      }
      const munisByCanonicalName: Record<string, Record<string, string[]>> = {};
      for (const [key, munisMap] of Object.entries(jsonProvince)) {
        munisByCanonicalName[DISTRICT_KEY_ALIASES[key] ?? key] = munisMap;
      }
      for (const d of p.districts) {
        const munisMap = munisByCanonicalName[d.name];
        if (!munisMap) {
          console.warn(`[Seed] ⚠️ No municipalities found for district ${d.name}`);
          continue;
        }
        const districtRow = await db.query.districts.findFirst({
          where: (ds, { eq }) => eq(ds.code, d.code),
        });
        if (!districtRow) {
          console.warn(`[Seed] ⚠️ District ${d.name} (${d.code}) not found in DB`);
          continue;
        }
        let muniIdx = 0;
        for (const [rawName, wardNos] of Object.entries(munisMap)) {
          const name = rawName.trim().replace(/\s+/g, ' ');
          const code = `${d.code}${String(muniIdx + 1).padStart(2, '0')}`;
          const type = detectMuniType(name);
          const [muni] = await db.insert(municipalities).values({
            districtId: districtRow.id,
            code,
            name,
            nameNepali: '',
            type,
          }).returning({ id: municipalities.id }).onConflictDoUpdate({
            target: municipalities.code,
            set: { name, type, districtId: districtRow.id },
          });
          const muniId = muni?.id ?? (await db.query.municipalities.findFirst({
            where: (ms, { eq }) => eq(ms.code, code),
          }))?.id;
          if (!muniId) {
            console.warn(`[Seed] ⚠️ Could not resolve municipality ${name} (${code})`);
            continue;
          }
          if (muni) municipalitiesUpserted++;
          const newWards = wardNos
            .map((w: string) => parseInt(w, 10))
            .filter((wn: number) => Number.isInteger(wn) && wn > 0)
            .map((wn: number) => ({ municipalityId: muniId, wardNo: wn }))
            .filter((wv) => !existingWardKeys.has(`${wv.municipalityId}:${wv.wardNo}`));
          if (newWards.length) {
            await db.insert(wards).values(newWards).onConflictDoNothing();
            newWards.forEach((wv) => existingWardKeys.add(`${wv.municipalityId}:${wv.wardNo}`));
            wardsSeeded += newWards.length;
          }
          muniIdx++;
        }
      }
    }
    console.log(`[Seed] → Municipalities: ${municipalitiesUpserted} upserted, Wards: ${wardsSeeded} new (upsert-safe)`);

    // 1. Branches
    console.log('[Seed] → Seeding branches...');
    if (softlabOrg) {
      for (const b of INITIAL_BRANCHES) {
        await db.insert(branches).values({
          id: toUuid(b.id), organizationId: softlabOrg.id, code: b.code, name: b.name, address: b.address,
          phone: b.phone, managerName: b.managerName,
          vaultLimit: String(b.vaultLimit), currentVaultCash: String(b.currentVaultCash),
        }).onConflictDoNothing();
      }
    }

    // 1b. Member classification catalogs (members.member_type_id / member_category_id
    // are NOT NULL FKs). Ensure the baseline rows exist and cache their ids.
    const memberTypeIds = new Map<string, string>();
    const memberCategoryIds = new Map<string, string>();
    if (softlabOrg) {
      for (const [code, name] of [['GENERAL', 'General'], ['FOUNDER', 'Founder'], ['INSTITUTIONAL', 'Institutional']]) {
        const [existing] = await db.select({ id: memberTypes.id }).from(memberTypes)
          .where(and(eq(memberTypes.organizationId, softlabOrg.id), eq(memberTypes.code, code)))
          .limit(1);
        if (existing) {
          memberTypeIds.set(name, existing.id);
        } else {
          const [created] = await db.insert(memberTypes)
            .values({ organizationId: softlabOrg.id, code, name, isSystem: true })
            .returning();
          memberTypeIds.set(name, created.id);
        }
      }
      for (const [code, name] of [['REGULAR', 'Regular'], ['VIP', 'VIP']]) {
        const [existing] = await db.select({ id: memberCategories.id }).from(memberCategories)
          .where(and(eq(memberCategories.organizationId, softlabOrg.id), eq(memberCategories.code, code)))
          .limit(1);
        if (existing) {
          memberCategoryIds.set(name, existing.id);
        } else {
          const [created] = await db.insert(memberCategories)
            .values({ organizationId: softlabOrg.id, code, name, isSystem: true })
            .returning();
          memberCategoryIds.set(name, created.id);
        }
      }
    }

    // 2. Members
    console.log('[Seed] → Seeding members...');
    if (!softlabOrg) {
      console.error('[Seed] ❌ SOFTLAB org not found — cannot seed members.');
      process.exit(1);
    }
    const defaultTypeId = memberTypeIds.get('General') ?? [...memberTypeIds.values()][0] ?? '';
    const defaultCategoryId = memberCategoryIds.get('Regular') ?? [...memberCategoryIds.values()][0] ?? '';
    for (const m of INITIAL_MEMBERS) {
      const memberId = toUuid(m.id);
      const annualIncome = m.annualIncome ? String(m.annualIncome).split('-')[0].replace(/[^0-9.]/g, '') : null;
      await db.insert(members).values({
        id: memberId,
        organizationId: softlabOrg.id,
        memberNo: m.memberNo,
        fullName: m.fullName,
        searchName: m.fullName.toLowerCase(),
        nameNepali: m.nameNepali,
        gender: m.gender,
        dobBs: m.dobBS,
        dobAd: m.dobAD,
        phone: m.phone,
        secondaryPhone: m.secondaryPhone,
        email: m.email,
        branchId: toUuid(m.branchId),
        kycStatus: m.kycStatus,
        membershipDateBs: m.membershipDateBS,
        memberTypeId: (m.membershipType && memberTypeIds.get(m.membershipType)) || defaultTypeId,
        memberCategoryId: (m.memberCategory && memberCategoryIds.get(m.memberCategory)) || defaultCategoryId,
        status: m.status,
      }).onConflictDoNothing();

      await db.insert(memberKycProfiles).values({
        memberId,
        organizationId: softlabOrg.id,
        citizenshipNo: m.citizenshipNo,
        citizenshipIssueDistrict: m.citizenshipIssueDistrict,
        citizenshipIssueDateBs: m.citizenshipIssueDateBS,
        photoUrl: m.photoUrl,
        signatureUrl: m.signatureUrl || null,
        citizenshipFrontUrl: m.citizenshipFrontUrl,
        citizenshipBackUrl: m.citizenshipBackUrl,
        address: m.address,
        district: m.district,
        permProvince: m.permProvince,
        permDistrict: m.permDistrict,
        permMunicipality: m.permMunicipality,
        permWard: m.permWard,
        permTole: m.permTole,
        tempProvince: m.tempProvince,
        tempDistrict: m.tempDistrict,
        tempMunicipality: m.tempMunicipality,
        tempWard: m.tempWard,
        tempTole: m.tempTole,
        employerName: m.employerName,
        annualIncome,
        sourceOfFunds: m.sourceOfFunds,
        isPep: m.isPEP ?? false,
        pepDetails: m.pepDetails,
        ethicsAccepted: m.ethicsAccepted ?? false,
      }).onConflictDoNothing();

      await db.insert(memberFinancialProfiles).values({
        memberId,
        organizationId: softlabOrg.id,
        totalShares: m.totalShares,
        shareAmount: String(m.shareAmount),
        totalSavingsBalance: String(m.totalSavingsBalance),
        totalLoanBalance: String(m.totalLoanBalance),
      }).onConflictDoNothing();

      await db.insert(memberFamily).values({
        memberId,
        maritalStatus: m.maritalStatus,
        bloodGroup: m.bloodGroup,
        fatherName: m.fatherName,
        motherName: m.motherName,
        grandfatherName: m.grandfatherName,
        spouseName: m.spouseName,
        dependentsCount: m.dependentsCount !== undefined ? Number(m.dependentsCount) : null,
        nomineeName: m.nomineeName,
        nomineePhone: m.nomineePhone,
        nomineeCitizenshipNo: m.nomineeCitizenshipNo,
        nomineeSharePct: m.nomineeSharePct ? String(m.nomineeSharePct) : null,
      }).onConflictDoNothing();

      await db.insert(memberPortalSettings).values({ memberId }).onConflictDoNothing();
      await db.insert(memberBiometrics).values({ memberId }).onConflictDoNothing();
    }

    // 4. Savings Accounts
    console.log('[Seed] → Seeding savings accounts...');
    if (softlabOrg) {
      for (const s of INITIAL_SAVINGS_ACCOUNTS) {
        await db.insert(savingsAccounts).values({
          organizationId: softlabOrg.id,
          accountNo: s.accountNo, memberId: toUuid(s.memberId),
          memberName: s.memberName, memberNo: s.memberNo,
          productType: s.productType as any, productName: s.productName,
          interestRate: String(s.interestRate), balance: String(s.balance),
          minBalance: String(s.minBalance), openedDateBs: s.openedDateBS,
          maturityDateBs: s.maturityDateBS,
          monthlyInstallment: s.monthlyInstallment ? String(s.monthlyInstallment) : null,
          branchId: toUuid(s.branchId), status: s.status as any,
          lastTransactionDateBs: s.lastTransactionDateBS,
        }).onConflictDoNothing();
      }
    }

    // 5. Loan Accounts
    console.log('[Seed] → Seeding loan accounts...');
    if (softlabOrg) {
      for (const l of INITIAL_LOAN_ACCOUNTS) {
        await db.insert(loanAccounts).values({
          organizationId: softlabOrg.id,
          loanNo: l.loanNo, memberId: toUuid(l.memberId),
          memberName: l.memberName, memberNo: l.memberNo,
          productType: l.productType as any, productName: l.productName,
          appliedAmount: String(l.appliedAmount), approvedAmount: String(l.approvedAmount),
          outstandingPrincipal: String(l.outstandingPrincipal),
          interestRate: String(l.interestRate), interestMethod: l.interestMethod as any,
          tenureMonths: l.tenureMonths, monthlyEmi: String(l.monthlyEMI),
          disbursedDateBs: l.disbursedDateBS, maturityDateBs: l.maturityDateBS,
          branchId: toUuid(l.branchId), status: l.status as any,
          nplStatus: l.nplStatus as any, daysOverdue: l.daysOverdue,
          overdueAmount: String(l.overdueAmount), provisionAmount: String(l.provisionAmount),
          lastRepaymentDateBs: l.lastRepaymentDateBS,
        }).onConflictDoNothing();
      }
    }

    // 6. Chart of Accounts
    console.log('[Seed] → Seeding chart of accounts...');
    if (softlabOrg) {
      for (const c of INITIAL_CHART_OF_ACCOUNTS) {
        await db.insert(chartOfAccounts).values({
          organizationId: softlabOrg.id,
          code: c.code, name: c.name,
          type: c.type as 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense',
          parentCode: c.parentCode, balance: String(c.balance),
          isSystemAccount: c.isSystemAccount ?? false,
        }).onConflictDoNothing();
      }
    }

    // 7. Vouchers + Entries
    console.log('[Seed] → Seeding vouchers...');
    if (softlabOrg) {
      for (const v of INITIAL_VOUCHERS) {
        const [insertedVoucher] = await db.insert(vouchers).values({
          organizationId: softlabOrg.id,
          voucherNo: v.voucherNo, voucherType: v.voucherType as any,
          dateBs: v.dateBS, dateAd: v.dateAD, branchId: toUuid(v.branchId),
          fiscalYearCode: '2083/84', preparedBy: v.preparedBy,
          approvedBy: v.approvedBy, status: v.status as any,
          totalAmount: String(v.totalAmount), narration: v.narration,
          moduleReference: v.moduleReference,
        }).returning({ id: vouchers.id }).onConflictDoNothing();

        if (insertedVoucher) {
          for (const entry of v.entries) {
            await db.insert(voucherEntries).values({
              organizationId: softlabOrg.id,
              voucherId: insertedVoucher.id, accountId: toUuid(entry.accountId),
              accountCode: entry.accountCode, accountName: entry.accountName,
              debit: String(entry.debit), credit: String(entry.credit),
              narration: entry.narration,
            }).onConflictDoNothing();
          }
        }
      }
    }

    // 8. Collection Routes
    console.log('[Seed] → Seeding collection routes...');
    if (softlabOrg) {
      for (const r of INITIAL_COLLECTION_ROUTES) {
        await db.insert(collectionRoutes).values({
          organizationId: softlabOrg.id,
          code: r.code, routeName: r.routeName,
          agentId: toUuid(r.agentId), agentName: r.agentName,
          assignedMembersCount: r.assignedMembersCount,
          todayTargetAmount: String(r.todayTargetAmount),
          todayCollectedAmount: String(r.todayCollectedAmount),
          status: r.status as any,
        }).onConflictDoNothing();
      }
    }

    // 9. Budget Lines (skipped: requires a parent budget record; seed budgets separately if needed)
    console.log('[Seed] → Skipping budget lines (requires parent budget record).');

    // 10. Fixed Assets
    console.log('[Seed] → Seeding fixed assets...');
    if (softlabOrg) {
      for (const a of INITIAL_FIXED_ASSETS) {
        await db.insert(fixedAssets).values({
          organizationId: softlabOrg.id,
          assetCode: a.assetCode, assetName: a.assetName,
          category: a.category as any, purchaseDateBs: a.purchaseDateBS,
          originalCost: String(a.originalCost),
          depreciationMethod: a.depreciationMethod as any,
          depreciationRatePercent: String(a.depreciationRatePercent),
          accumulatedDepreciation: String(a.accumulatedDepreciation),
          currentBookValue: String(a.currentBookValue),
          branchId: toUuid(a.branchId), location: a.location, status: a.status as any,
        }).onConflictDoNothing();
      }
    }

    // 11. Approval Requests
    console.log('[Seed] → Seeding approval requests...');
    if (softlabOrg) {
      for (const a of INITIAL_APPROVAL_REQUESTS) {
        await db.insert(approvalRequests).values({
          organizationId: softlabOrg.id,
          requestType: a.requestType as any, referenceNo: a.referenceNo,
          requestedBy: toUuid(a.requestedBy), requestedDateBs: a.requestedDateBS,
          amount: String(a.amount), description: a.description,
          branchId: toUuid(a.branchId), status: a.status as any,
          approvedBy: a.approvedBy ? toUuid(a.approvedBy) : null, remarks: a.remarks,
        }).onConflictDoNothing();
      }
    }

    // 12. Audit Logs
    console.log('[Seed] → Seeding audit logs...');
    if (softlabOrg) {
      for (const l of INITIAL_AUDIT_LOGS) {
        await db.insert(auditLogs).values({
          organizationId: softlabOrg.id,
          timestampBs: l.timestampBS, timestampAd: l.timestampAD,
          userName: l.userName, userRole: l.userRole, module: l.module,
          action: l.action, details: l.details, ipAddress: l.ipAddress,
        }).onConflictDoNothing();
      }
    }

    console.log('\n[Seed] ✅ Database seeded successfully!');
    console.log('[Seed] Records inserted:');
    console.log(`  → Branches: ${INITIAL_BRANCHES.length}`);
    console.log(`  → Members: ${INITIAL_MEMBERS.length}`);
    console.log(`  → Savings Accounts: ${INITIAL_SAVINGS_ACCOUNTS.length}`);
    console.log(`  → Loan Accounts: ${INITIAL_LOAN_ACCOUNTS.length}`);
    console.log(`  → Chart of Accounts: ${INITIAL_CHART_OF_ACCOUNTS.length}`);
    console.log(`  → Vouchers: ${INITIAL_VOUCHERS.length}`);
    process.exit(0);
  } catch (error) {
    console.error('[Seed] ❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
