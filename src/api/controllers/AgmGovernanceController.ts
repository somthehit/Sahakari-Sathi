/**
 * AgmGovernanceController
 * Generates AGM & Governance reports from REAL organizational + governance data.
 * Covers: AGM Presentation Pack, Resolution & Minutes, Board Meeting, Attendance & Quorum.
 */
import { Request, Response } from 'express';
import { and, eq, sql, desc } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { organizations, organizationProfiles, employees, departments, designations } from '../../db/schema/auth';
import { members } from '../../db/schema/members';
import { fiscalYears } from '../../db/schema/branches';
import { chartOfAccounts } from '../../db/schema/accounting';
import { loanAccounts } from '../../db/schema/loans';
import { savingsAccounts } from '../../db/schema/savings';
import { shareAccounts } from '../../db/schema/shares';
import { agmMeetings, agmAttendees, agmResolutions, agmNews } from '../../db/schema/governance';

interface OrgUser {
  organizationId?: string;
  username?: string;
}

async function getOrgInfo(db: any, organizationId: string) {
  const [org] = await db.select().from(organizations)
    .where(eq(organizations.id, organizationId)).limit(1);
  const [profile] = await db.select().from(organizationProfiles)
    .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);
  return { org, profile };
}

async function getActiveFy(db: any, organizationId: string) {
  const [fy] = await db.select().from(fiscalYears)
    .where(and(eq(fiscalYears.organizationId, organizationId), eq(fiscalYears.isCurrent, true)))
    .limit(1);
  return fy || null;
}

async function getMemberList(db: any, organizationId: string) {
  return db.select({
    id: members.id,
    memberNo: members.memberNo,
    fullName: members.fullName,
    phone: members.phone,
    status: members.status,
    membershipDateBs: members.membershipDateBs,
  }).from(members)
    .where(eq(members.organizationId, organizationId))
    .orderBy(members.memberNo);
}

async function getStaffList(db: any, organizationId: string) {
  const rows = await db.select({
    id: employees.id,
    firstName: employees.firstName,
    middleName: employees.middleName,
    lastName: employees.lastName,
    departmentId: employees.departmentId,
    designationId: employees.designationId,
    phone: employees.phone,
    email: employees.email,
    status: employees.status,
    departmentName: departments.name,
    designationName: designations.name,
  }).from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(designations, eq(employees.designationId, designations.id))
    .where(eq(employees.organizationId, organizationId))
    .orderBy(employees.firstName);
  return rows.map((r: any) => ({
    ...r,
    fullName: [r.firstName, r.middleName, r.lastName].filter(Boolean).join(' '),
    designation: r.designationName || '',
    department: r.departmentName || '',
  }));
}

async function getGlBalances(db: any, organizationId: string) {
  const rows = await db.select({
    type: chartOfAccounts.type,
    total: sql<string>`COALESCE(sum(${chartOfAccounts.balance}), 0)`,
  }).from(chartOfAccounts)
    .where(eq(chartOfAccounts.organizationId, organizationId))
    .groupBy(chartOfAccounts.type);
  const map: Record<string, number> = {};
  rows.forEach((r: any) => { map[r.type] = Number(r.total) || 0; });
  return map;
}

async function getLoanSummary(db: any, organizationId: string) {
  const [agg] = await db.select({
    count: sql<string>`count(*)`,
    totalDisbursed: sql<string>`COALESCE(sum(${loanAccounts.disbursedAmount}), 0)`,
    outstanding: sql<string>`COALESCE(sum(${loanAccounts.outstandingPrincipal}), 0)`,
    overdue: sql<string>`COALESCE(sum(${loanAccounts.overdueAmount}), 0)`,
  }).from(loanAccounts)
    .where(eq(loanAccounts.organizationId, organizationId));
  return {
    count: Number(agg?.count || 0),
    totalDisbursed: Number(agg?.totalDisbursed || 0),
    outstanding: Number(agg?.outstanding || 0),
    overdue: Number(agg?.overdue || 0),
  };
}

async function getSavingsSummary(db: any, organizationId: string) {
  const [agg] = await db.select({
    count: sql<string>`count(*)`,
    totalBalance: sql<string>`COALESCE(sum(${savingsAccounts.balance}), 0)`,
  }).from(savingsAccounts)
    .where(eq(savingsAccounts.organizationId, organizationId));
  return { count: Number(agg?.count || 0), totalBalance: Number(agg?.totalBalance || 0) };
}

async function getShareSummary(db: any, organizationId: string) {
  const [agg] = await db.select({
    count: sql<string>`count(*)`,
    totalCapital: sql<string>`COALESCE(sum(${shareAccounts.totalCapitalAmount}), 0)`,
  }).from(shareAccounts)
    .where(eq(shareAccounts.organizationId, organizationId));
  return { count: Number(agg?.count || 0), totalCapital: Number(agg?.totalCapital || 0) };
}

// ─── Governance helpers ──────────────────────────────────────────────────────

async function getLatestMeeting(db: any, organizationId: string, type?: string) {
  const conditions = [eq(agmMeetings.organizationId, organizationId)];
  if (type) conditions.push(eq(agmMeetings.type, type));
  const [meeting] = await db.select().from(agmMeetings)
    .where(and(...conditions))
    .orderBy(desc(agmMeetings.meetingDateBs))
    .limit(1);
  return meeting || null;
}

async function getMeetingAttendees(db: any, meetingId: string, organizationId: string) {
  return db.select().from(agmAttendees)
    .where(and(eq(agmAttendees.meetingId, meetingId), eq(agmAttendees.organizationId, organizationId)))
    .orderBy(agmAttendees.memberNo);
}

async function getMeetingResolutions(db: any, meetingId: string, organizationId: string) {
  return db.select().from(agmResolutions)
    .where(and(eq(agmResolutions.meetingId, meetingId), eq(agmResolutions.organizationId, organizationId)))
    .orderBy(agmResolutions.resolutionNo);
}

async function getRecentNews(db: any, organizationId: string, limit = 10) {
  return db.select().from(agmNews)
    .where(eq(agmNews.organizationId, organizationId))
    .orderBy(desc(agmNews.createdAt))
    .limit(limit);
}

export class AgmGovernanceController {

  /**
   * GET /api/v1/reports/agm-presentation-pack
   * AGM Presentation Report Pack — comprehensive annual report for AGM.
   * Now uses real meeting data when available.
   */
  static async getAgmPresentationPack(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const { org, profile } = await getOrgInfo(db, organizationId);
      const fy = await getActiveFy(db, organizationId);
      const gl = await getGlBalances(db, organizationId);
      const membersList = await getMemberList(db, organizationId);
      const loans = await getLoanSummary(db, organizationId);
      const savings = await getSavingsSummary(db, organizationId);
      const shares = await getShareSummary(db, organizationId);

      // Real AGM data
      const agmMeeting = await getLatestMeeting(db, organizationId, 'AGM');
      let attendees: any[] = [];
      let resolutions: any[] = [];
      let agendaItems: any[] = [];
      if (agmMeeting) {
        attendees = await getMeetingAttendees(db, agmMeeting.id, organizationId);
        resolutions = await getMeetingResolutions(db, agmMeeting.id, organizationId);
        agendaItems = Array.isArray(agmMeeting.agenda) ? agmMeeting.agenda : [];
      }

      const totalIncome = gl['Income'] || 0;
      const totalExpense = gl['Expense'] || 0;
      const activeMembers = membersList.filter((m: any) => m.status === 'Active').length;
      const presentCount = attendees.filter((a: any) => a.attended).length;

      res.json({
        organization: {
          name: org?.organizationName || 'N/A',
          registrationNo: profile?.registrationNo || org?.govtRegNo || 'N/A',
          address: org?.address || 'N/A',
          phone: org?.phone || 'N/A',
        },
        fiscalYear: fy ? { code: fy.code, startDateBs: fy.startDateBs, endDateBs: fy.endDateBs } : null,
        // Real AGM meeting data
        agmMeeting: agmMeeting ? {
          id: agmMeeting.id,
          title: agmMeeting.title,
          titleNepali: agmMeeting.titleNepali,
          type: agmMeeting.type,
          date: agmMeeting.meetingDateBs,
          startTime: agmMeeting.startTime,
          endTime: agmMeeting.endTime,
          venue: agmMeeting.venue,
          venueNepali: agmMeeting.venueNepali,
          status: agmMeeting.status,
          chairedBy: agmMeeting.chairedBy,
          secretaryName: agmMeeting.secretaryName,
        } : null,
        agendaItems: agendaItems.map((item: any, idx: number) => ({
          item: item.order || idx + 1,
          title: item.title,
          titleNepali: item.titleNepali,
          description: item.description,
          type: item.type,
        })),
        overview: {
          totalMembers: membersList.length,
          activeMembers,
          totalShareCapital: shares.totalCapital,
          totalSavings: savings.totalBalance,
          totalLoanDisbursed: loans.totalDisbursed,
          loanOutstanding: loans.outstanding,
          loanOverdue: loans.overdue,
          activeLoans: loans.count,
          savingsAccounts: savings.count,
          shareAccounts: shares.count,
        },
        financials: {
          totalAssets: gl['Asset'] || 0,
          totalLiabilities: gl['Liability'] || 0,
          totalEquity: gl['Equity'] || 0,
          totalIncome,
          totalExpense,
          netSurplus: totalIncome - totalExpense,
        },
        // Real resolutions passed at AGM
        resolutions: resolutions.map((r: any) => ({
          resolutionNo: r.resolutionNo,
          title: r.title,
          titleNepali: r.titleNepali,
          description: r.description,
          proposedBy: r.proposedBy,
          secondedBy: r.secondedBy,
          status: r.status,
          decision: r.decision,
          votesFor: r.votesFor,
          votesAgainst: r.votesAgainst,
          abstained: r.abstained,
        })),
        attendance: {
          totalInvited: attendees.length,
          present: presentCount,
          absent: attendees.length - presentCount,
          quorumPercentage: agmMeeting?.quorumPercentage || 50,
          quorumMet: agmMeeting?.quorumRequired ? presentCount >= agmMeeting.quorumRequired : presentCount >= Math.ceil(activeMembers * 0.5),
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('AgmGovernanceController.getAgmPresentationPack:', error);
      res.status(500).json({ error: error.message || 'Failed to generate AGM Presentation Pack.' });
    }
  }

  /**
   * GET /api/v1/reports/agm-resolution-minutes
   * AGM Resolution & Minutes Summary — real agenda + resolutions from DB.
   */
  static async getAgmResolutionMinutes(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const { org, profile } = await getOrgInfo(db, organizationId);
      const fy = await getActiveFy(db, organizationId);
      const membersList = await getMemberList(db, organizationId);
      const staffList = await getStaffList(db, organizationId);

      const activeMembers = membersList.filter((m: any) => m.status === 'Active');
      const boardMembers = staffList.filter((s: any) =>
        s.designation?.toLowerCase().includes('chair') ||
        s.designation?.toLowerCase().includes('vice') ||
        s.designation?.toLowerCase().includes('secretary') ||
        s.designation?.toLowerCase().includes('treasurer') ||
        s.designation?.toLowerCase().includes('member') ||
        s.designation?.toLowerCase().includes('board') ||
        s.designation?.toLowerCase().includes('sanchalak') ||
        s.designation?.toLowerCase().includes('adhyaksh')
      );

      // Real AGM data
      const agmMeeting = await getLatestMeeting(db, organizationId, 'AGM');
      let attendees: any[] = [];
      let resolutions: any[] = [];
      let agendaItems: any[] = [];
      if (agmMeeting) {
        attendees = await getMeetingAttendees(db, agmMeeting.id, organizationId);
        resolutions = await getMeetingResolutions(db, agmMeeting.id, organizationId);
        agendaItems = Array.isArray(agmMeeting.agenda) ? agmMeeting.agenda : [];
      }

      res.json({
        organization: {
          name: org?.organizationName || 'N/A',
          registrationNo: profile?.registrationNo || org?.govtRegNo || 'N/A',
        },
        fiscalYear: fy ? { code: fy.code, startDateBs: fy.startDateBs, endDateBs: fy.endDateBs } : null,
        agmMeeting: agmMeeting ? {
          title: agmMeeting.title,
          date: agmMeeting.meetingDateBs,
          venue: agmMeeting.venue,
          status: agmMeeting.status,
          chairedBy: agmMeeting.chairedBy,
          secretaryName: agmMeeting.secretaryName,
          minutesSummary: agmMeeting.minutesSummary,
        } : null,
        boardOfDirectors: boardMembers.map((s: any) => ({
          name: s.fullName,
          designation: s.designation,
          department: s.department,
          phone: s.phone,
          email: s.email,
        })),
        memberSummary: {
          totalMembers: membersList.length,
          activeMembers: activeMembers.length,
        },
        // Real agenda from meeting
        agendaItems: agendaItems.length > 0
          ? agendaItems.map((item: any, idx: number) => ({
              item: item.order || idx + 1,
              title: item.title,
              titleNepali: item.titleNepali,
              description: item.description,
              type: item.type,
            }))
          : [
              { item: 1, title: 'Annual Report Presentation', titleNepali: 'वार्षिक प्रतिवेदन', description: 'Presentation of annual performance report.', type: 'Presentation' },
              { item: 2, title: 'Audited Financial Statements', titleNepali: 'लेखापरीक्षित वित्तीय विवरण', description: 'Review and approval of audited statements.', type: 'Financial' },
              { item: 3, title: 'Dividend/Interest Rate Declaration', titleNepali: 'लाभांश/ब्याजदर घोषणा', description: 'Declaration of dividend and interest rates.', type: 'Financial' },
              { item: 4, title: 'Appointment of Auditors', titleNepali: 'लेखापरीक्षक नियुक्ति', description: 'Appointment of auditor for next FY.', type: 'General' },
              { item: 5, title: 'Board Election/Re-election', titleNepali: 'सञ्चालक समिति निर्वाचन', description: 'Election of board members.', type: 'Election' },
              { item: 6, title: 'Budget Approval', titleNepali: 'बजेट स्वीकृति', description: 'Approval of proposed budget.', type: 'Financial' },
              { item: 7, title: 'Any Other Business', titleNepali: 'अन्य कारोबार', description: 'Any other business with chair approval.', type: 'General' },
            ],
        // Real resolutions
        resolutions: resolutions.map((r: any) => ({
          resolutionNo: r.resolutionNo,
          title: r.title,
          titleNepali: r.titleNepali,
          description: r.description,
          proposedBy: r.proposedBy,
          secondedBy: r.secondedBy,
          status: r.status,
          decision: r.decision,
          votesFor: r.votesFor,
          votesAgainst: r.votesAgainst,
          abstained: r.abstained,
          assignedTo: r.assignedTo,
          dueDateBs: r.dueDateBs,
        })),
        minutes: {
          summary: agmMeeting?.minutesSummary || null,
          totalResolutions: resolutions.length,
          approved: resolutions.filter((r: any) => r.status === 'Approved').length,
          rejected: resolutions.filter((r: any) => r.status === 'Rejected').length,
          deferred: resolutions.filter((r: any) => r.status === 'Deferred').length,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('AgmGovernanceController.getAgmResolutionMinutes:', error);
      res.status(500).json({ error: error.message || 'Failed to generate AGM Resolution & Minutes.' });
    }
  }

  /**
   * GET /api/v1/reports/board-meeting
   * Board/Committee Meeting Reports — real meeting data.
   */
  static async getBoardMeetingReport(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const { org, profile } = await getOrgInfo(db, organizationId);
      const fy = await getActiveFy(db, organizationId);
      const staffList = await getStaffList(db, organizationId);
      const gl = await getGlBalances(db, organizationId);
      const loans = await getLoanSummary(db, organizationId);
      const savings = await getSavingsSummary(db, organizationId);
      const shares = await getShareSummary(db, organizationId);
      const membersList = await getMemberList(db, organizationId);

      const boardMembers = staffList.filter((s: any) =>
        s.designation?.toLowerCase().includes('chair') ||
        s.designation?.toLowerCase().includes('vice') ||
        s.designation?.toLowerCase().includes('secretary') ||
        s.designation?.toLowerCase().includes('treasurer') ||
        s.designation?.toLowerCase().includes('board') ||
        s.designation?.toLowerCase().includes('sanchalak') ||
        s.designation?.toLowerCase().includes('adhyaksh')
      );

      const committees = staffList.filter((s: any) =>
        s.department?.toLowerCase().includes('audit') ||
        s.department?.toLowerCase().includes('credit') ||
        s.department?.toLowerCase().includes('supervision') ||
        s.department?.toLowerCase().includes('committee')
      );

      // Real board meeting data
      const boardMeeting = await getLatestMeeting(db, organizationId, 'Board');
      let attendees: any[] = [];
      let resolutions: any[] = [];
      let agendaItems: any[] = [];
      if (boardMeeting) {
        attendees = await getMeetingAttendees(db, boardMeeting.id, organizationId);
        resolutions = await getMeetingResolutions(db, boardMeeting.id, organizationId);
        agendaItems = Array.isArray(boardMeeting.agenda) ? boardMeeting.agenda : [];
      }

      // Also get recent meetings of all types
      const allMeetings = await db.select().from(agmMeetings)
        .where(eq(agmMeetings.organizationId, organizationId))
        .orderBy(desc(agmMeetings.meetingDateBs))
        .limit(10);

      const totalIncome = gl['Income'] || 0;
      const totalExpense = gl['Expense'] || 0;

      res.json({
        organization: {
          name: org?.organizationName || 'N/A',
          registrationNo: profile?.registrationNo || org?.govtRegNo || 'N/A',
          address: org?.address || 'N/A',
        },
        fiscalYear: fy ? { code: fy.code, startDateBs: fy.startDateBs, endDateBs: fy.endDateBs } : null,
        // Latest board meeting
        currentMeeting: boardMeeting ? {
          title: boardMeeting.title,
          date: boardMeeting.meetingDateBs,
          startTime: boardMeeting.startTime,
          endTime: boardMeeting.endTime,
          venue: boardMeeting.venue,
          status: boardMeeting.status,
          chairedBy: boardMeeting.chairedBy,
          secretaryName: boardMeeting.secretaryName,
        } : null,
        agendaItems: agendaItems.map((item: any, idx: number) => ({
          item: item.order || idx + 1,
          title: item.title,
          titleNepali: item.titleNepali,
          description: item.description,
          type: item.type,
        })),
        boardMembers: boardMembers.map((s: any) => ({
          name: s.fullName,
          designation: s.designation,
          department: s.department,
          phone: s.phone,
          email: s.email,
        })),
        committees: committees.map((s: any) => ({
          name: s.fullName,
          designation: s.designation,
          department: s.department,
        })),
        // Real attendance
        attendance: {
          totalInvited: attendees.length,
          present: attendees.filter((a: any) => a.attended).length,
          absent: attendees.filter((a: any) => !a.attended).length,
          guests: attendees.filter((a: any) => a.isGuest).length,
        },
        // Real resolutions from board meeting
        resolutions: resolutions.map((r: any) => ({
          resolutionNo: r.resolutionNo,
          title: r.title,
          titleNepali: r.titleNepali,
          status: r.status,
          proposedBy: r.proposedBy,
          secondedBy: r.secondedBy,
          decision: r.decision,
        })),
        // Recent meeting history
        recentMeetings: allMeetings.map((m: any) => ({
          title: m.title,
          type: m.type,
          date: m.meetingDateBs,
          venue: m.venue,
          status: m.status,
          resolutionsCount: m.resolutionsCount || 0,
        })),
        financialHighlights: {
          totalAssets: gl['Asset'] || 0,
          totalLiabilities: gl['Liability'] || 0,
          totalEquity: gl['Equity'] || 0,
          totalIncome,
          totalExpense,
          netSurplus: totalIncome - totalExpense,
        },
        operationalHighlights: {
          totalMembers: membersList.length,
          activeLoans: loans.count,
          loanOutstanding: loans.outstanding,
          loanOverdue: loans.overdue,
          totalSavings: savings.totalBalance,
          totalShareCapital: shares.totalCapital,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('AgmGovernanceController.getBoardMeetingReport:', error);
      res.status(500).json({ error: error.message || 'Failed to generate Board Meeting Report.' });
    }
  }

  /**
   * GET /api/v1/reports/agm-attendance-quorum
   * AGM Member Attendance & Quorum Report — real attendee data from AGM.
   */
  static async getAgmAttendanceQuorum(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const { org, profile } = await getOrgInfo(db, organizationId);
      const fy = await getActiveFy(db, organizationId);
      const membersList = await getMemberList(db, organizationId);

      const activeMembers = membersList.filter((m: any) => m.status === 'Active');

      // Real AGM data
      const agmMeeting = await getLatestMeeting(db, organizationId, 'AGM');
      let attendees: any[] = [];
      if (agmMeeting) {
        attendees = await getMeetingAttendees(db, agmMeeting.id, organizationId);
      }

      const presentCount = attendees.filter((a: any) => a.attended).length;
      const proxyCount = attendees.filter((a: any) => a.proxyGiven).length;
      const guestCount = attendees.filter((a: any) => a.isGuest).length;
      const quorumRequired = agmMeeting?.quorumRequired || Math.ceil(activeMembers.length * (agmMeeting?.quorumPercentage || 50) / 100);

      res.json({
        organization: {
          name: org?.organizationName || 'N/A',
          registrationNo: profile?.registrationNo || org?.govtRegNo || 'N/A',
        },
        fiscalYear: fy ? { code: fy.code, startDateBs: fy.startDateBs, endDateBs: fy.endDateBs } : null,
        agmMeeting: agmMeeting ? {
          title: agmMeeting.title,
          date: agmMeeting.meetingDateBs,
          venue: agmMeeting.venue,
          status: agmMeeting.status,
          quorumPercentage: agmMeeting.quorumPercentage || 50,
        } : null,
        quorum: {
          totalMembers: membersList.length,
          activeMembers: activeMembers.length,
          totalAttendees: attendees.length,
          present: presentCount,
          proxy: proxyCount,
          guests: guestCount,
          absent: attendees.length - presentCount,
          quorumRequired,
          quorumPercentage: agmMeeting?.quorumPercentage || 50,
          quorumMet: presentCount >= quorumRequired,
          status: presentCount >= quorumRequired ? 'Quorum Achieved' : 'Quorum Not Achieved',
        },
        // Real attendee data
        members: attendees.map((a: any, index: number) => ({
          sno: index + 1,
          memberNo: a.memberNo,
          fullName: a.memberName,
          isGuest: a.isGuest,
          guestName: a.guestName,
          guestRole: a.guestRole,
          attended: a.attended,
          proxyGiven: a.proxyGiven,
          proxyTo: a.proxyTo,
          signatureReceived: a.signatureReceived,
          remarks: a.remarks,
        })),
        // If no attendees recorded, show member list as template
        memberTemplate: attendees.length === 0
          ? activeMembers.map((m: any, index: number) => ({
              sno: index + 1,
              memberNo: m.memberNo,
              fullName: m.fullName,
              phone: m.phone,
              attendanceEligible: true,
            }))
          : null,
        attendanceTemplate: {
          columns: ['S.N.', 'Member No.', 'Full Name', 'Present', 'Absent', 'Proxy', 'Signature'],
          note: attendees.length === 0
            ? 'No attendees recorded yet. Use "Add All Active Members" in AGM Management to populate attendance.'
            : `Showing ${attendees.length} recorded attendees for the latest AGM.`,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('AgmGovernanceController.getAgmAttendanceQuorum:', error);
      res.status(500).json({ error: error.message || 'Failed to generate AGM Attendance & Quorum Report.' });
    }
  }
}
