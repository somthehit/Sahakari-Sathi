import { apiClient } from '../lib/apiClient';

export interface OrgInfo { name: string; registrationNo: string; address?: string; phone?: string; }
export interface FiscalYear { code: string; startDateBs: string; endDateBs: string; }

export interface AgendaItem {
  item: number;
  title: string;
  titleNepali?: string;
  description?: string;
  type?: string;
}

export interface MeetingInfo {
  id?: string;
  title: string;
  titleNepali?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  venueNepali?: string;
  status: string;
  chairedBy?: string;
  secretaryName?: string;
  quorumPercentage?: number;
  minutesSummary?: string;
}

export interface ResolutionInfo {
  resolutionNo: number;
  title: string;
  titleNepali?: string;
  description?: string;
  proposedBy?: string;
  secondedBy?: string;
  status: string;
  decision?: string;
  votesFor?: number;
  votesAgainst?: number;
  abstained?: number;
  assignedTo?: string;
  dueDateBs?: string;
}

export interface AttendeeInfo {
  sno: number;
  memberNo?: string;
  fullName?: string;
  isGuest?: boolean;
  guestName?: string;
  guestRole?: string;
  attended?: boolean;
  proxyGiven?: boolean;
  proxyTo?: string;
  signatureReceived?: boolean;
  remarks?: string;
  phone?: string;
}

export interface AgmPackResponse {
  organization: OrgInfo;
  fiscalYear: FiscalYear | null;
  agmMeeting: MeetingInfo | null;
  agendaItems: AgendaItem[];
  overview: {
    totalMembers: number; activeMembers: number; totalShareCapital: number;
    totalSavings: number; totalLoanDisbursed: number; loanOutstanding: number;
    loanOverdue: number; activeLoans: number; savingsAccounts: number; shareAccounts: number;
  };
  financials: {
    totalAssets: number; totalLiabilities: number; totalEquity: number;
    totalIncome: number; totalExpense: number; netSurplus: number;
  };
  resolutions: ResolutionInfo[];
  attendance: {
    totalInvited: number; present: number; absent: number;
    quorumPercentage: number; quorumMet: boolean;
  };
  generatedAt: string;
}

export interface AgmMinutesResponse {
  organization: OrgInfo;
  fiscalYear: FiscalYear | null;
  agmMeeting: MeetingInfo | null;
  boardOfDirectors: { name: string; designation: string; department?: string; phone?: string; email?: string; }[];
  memberSummary: { totalMembers: number; activeMembers: number; };
  agendaItems: AgendaItem[];
  resolutions: ResolutionInfo[];
  minutes: { summary: string | null; totalResolutions: number; approved: number; rejected: number; deferred: number; };
  generatedAt: string;
}

export interface BoardMeetingResponse {
  organization: OrgInfo;
  fiscalYear: FiscalYear | null;
  currentMeeting: MeetingInfo | null;
  agendaItems: AgendaItem[];
  boardMembers: { name: string; designation: string; department?: string; phone?: string; email?: string; }[];
  committees: { name: string; designation: string; department?: string; }[];
  attendance: { totalInvited: number; present: number; absent: number; guests: number; };
  resolutions: ResolutionInfo[];
  recentMeetings: { title: string; type: string; date: string; venue?: string; status: string; resolutionsCount: number; }[];
  financialHighlights: {
    totalAssets: number; totalLiabilities: number; totalEquity: number;
    totalIncome: number; totalExpense: number; netSurplus: number;
  };
  operationalHighlights: {
    totalMembers: number; activeLoans: number; loanOutstanding: number;
    loanOverdue: number; totalSavings: number; totalShareCapital: number;
  };
  generatedAt: string;
}

export interface AgmAttendanceResponse {
  organization: OrgInfo;
  fiscalYear: FiscalYear | null;
  agmMeeting: MeetingInfo | null;
  quorum: {
    totalMembers: number; activeMembers: number; totalAttendees: number;
    present: number; proxy: number; guests: number; absent: number;
    quorumRequired: number; quorumPercentage: number; quorumMet: boolean; status: string;
  };
  members: AttendeeInfo[];
  memberTemplate: { sno: number; memberNo: string; fullName: string; phone: string; attendanceEligible: boolean; }[] | null;
  attendanceTemplate: { columns: string[]; note: string; };
  generatedAt: string;
}

export const fetchAgmPack = async (): Promise<AgmPackResponse> => (await apiClient.get('/reports/agm-presentation-pack')).data;
export const fetchAgmMinutes = async (): Promise<AgmMinutesResponse> => (await apiClient.get('/reports/agm-resolution-minutes')).data;
export const fetchBoardMeeting = async (): Promise<BoardMeetingResponse> => (await apiClient.get('/reports/board-meeting')).data;
export const fetchAgmAttendance = async (): Promise<AgmAttendanceResponse> => (await apiClient.get('/reports/agm-attendance-quorum')).data;
