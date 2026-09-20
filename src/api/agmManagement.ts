import { apiClient } from '../lib/apiClient';

// Types
export interface AgmAgendaItem {
  order: number;
  title: string;
  titleNepali?: string;
  description?: string;
  type?: string;
}

export interface AgmMeeting {
  id: string; organizationId: string; title: string; titleNepali?: string;
  type: string; meetingDateBs: string; meetingDateAd?: string;
  startTime?: string; endTime?: string; venue?: string; venueNepali?: string;
  description?: string; agenda?: AgmAgendaItem[]; status: string;
  quorumRequired?: number; quorumPercentage?: number;
  resolutionsCount?: number; minutesSummary?: string;
  calledBy?: string; chairedBy?: string; secretaryName?: string;
  createdBy?: string; createdAt: string; updatedAt: string;
}
export interface AgmAttendee {
  id: string; organizationId: string; meetingId: string;
  memberId?: string; memberNo?: string; memberName?: string;
  attended?: boolean; proxyGiven?: boolean; proxyTo?: string;
  isGuest?: boolean; guestName?: string; guestRole?: string;
  signatureReceived?: boolean; remarks?: string;
  createdBy?: string; createdAt: string;
}
export interface AgmResolution {
  id: string; organizationId: string; meetingId: string;
  resolutionNo: number; title: string; titleNepali?: string;
  description?: string; proposedBy?: string; secondedBy?: string;
  status: string; votesFor?: number; votesAgainst?: number; abstained?: number;
  decision?: string; assignedTo?: string; dueDateBs?: string;
  completedAt?: string; attachments?: { name: string; url: string; size?: number; type?: string }[];
  createdBy?: string; createdAt: string; updatedAt: string;
}
export interface AgmNewsItem {
  id: string; organizationId: string; title: string; titleNepali?: string;
  content?: string; contentNepali?: string; category: string; priority: string;
  publishDateBs?: string; expiryDateBs?: string; isPublished?: boolean;
  attachments?: { name: string; url: string; size?: number }[];
  createdBy?: string; createdAt: string; updatedAt: string;
}
export interface AgmTeamMember {
  id: string; organizationId: string; meetingId?: string; employeeId?: string;
  name: string; nameNepali?: string; role: string;
  category: string; designation?: string; phone?: string; email?: string;
  address?: string; photoUrl?: string;
  documents?: { name: string; url: string; size?: number; type?: string }[];
  orderIndex?: number; status: string;
  joinedDateBs?: string; tenureEndBs?: string; notes?: string;
  createdBy?: string; createdAt: string; updatedAt: string;
}

// Meetings
export const fetchMeetings = async (): Promise<AgmMeeting[]> => (await apiClient.get('/agm/meetings')).data;
export const fetchMeeting = async (id: string): Promise<AgmMeeting> => (await apiClient.get(`/agm/meetings/${id}`)).data;
export const createMeeting = async (data: Partial<AgmMeeting>): Promise<AgmMeeting> => (await apiClient.post('/agm/meetings', data)).data;
export const updateMeeting = async (id: string, data: Partial<AgmMeeting>): Promise<AgmMeeting> => (await apiClient.put(`/agm/meetings/${id}`, data)).data;
export const updateMeetingAgenda = async (id: string, agenda: AgmAgendaItem[]): Promise<AgmMeeting> => (await apiClient.patch(`/agm/meetings/${id}/agenda`, { agenda })).data;
export const deleteMeeting = async (id: string): Promise<{ id: string }> => (await apiClient.delete(`/agm/meetings/${id}`)).data;

// Attendees
export const fetchAttendees = async (meetingId: string): Promise<AgmAttendee[]> => (await apiClient.get(`/agm/meetings/${meetingId}/attendees`)).data;
export const addAttendee = async (meetingId: string, data: Partial<AgmAttendee>): Promise<AgmAttendee> => (await apiClient.post(`/agm/meetings/${meetingId}/attendees`, data)).data;
export const bulkAddMembers = async (meetingId: string): Promise<{ added: number }> => (await apiClient.post(`/agm/meetings/${meetingId}/attendees/bulk`)).data;
export const updateAttendee = async (id: string, data: Partial<AgmAttendee>): Promise<AgmAttendee> => (await apiClient.put(`/agm/attendees/${id}`, data)).data;
export const deleteAttendee = async (id: string): Promise<{ id: string }> => (await apiClient.delete(`/agm/attendees/${id}`)).data;

// Resolutions
export const fetchResolutions = async (meetingId: string): Promise<AgmResolution[]> => (await apiClient.get(`/agm/meetings/${meetingId}/resolutions`)).data;
export const addResolution = async (meetingId: string, data: Partial<AgmResolution>): Promise<AgmResolution> => (await apiClient.post(`/agm/meetings/${meetingId}/resolutions`, data)).data;
export const updateResolution = async (id: string, data: Partial<AgmResolution>): Promise<AgmResolution> => (await apiClient.put(`/agm/resolutions/${id}`, data)).data;
export const deleteResolution = async (id: string): Promise<{ id: string }> => (await apiClient.delete(`/agm/resolutions/${id}`)).data;

// News
export const fetchNews = async (): Promise<AgmNewsItem[]> => (await apiClient.get('/agm/news')).data;
export const createNews = async (data: Partial<AgmNewsItem>): Promise<AgmNewsItem> => (await apiClient.post('/agm/news', data)).data;
export const updateNews = async (id: string, data: Partial<AgmNewsItem>): Promise<AgmNewsItem> => (await apiClient.put(`/agm/news/${id}`, data)).data;
export const deleteNews = async (id: string): Promise<{ id: string }> => (await apiClient.delete(`/agm/news/${id}`)).data;

// Team Members
export const fetchTeamMembers = async (category?: string): Promise<AgmTeamMember[]> => {
  const params = category ? `?category=${category}` : '';
  return (await apiClient.get(`/agm/team${params}`)).data;
};
export const fetchTeamMember = async (id: string): Promise<AgmTeamMember> => (await apiClient.get(`/agm/team/${id}`)).data;
export const addTeamMember = async (data: Partial<AgmTeamMember>): Promise<AgmTeamMember> => (await apiClient.post('/agm/team', data)).data;
export const updateTeamMember = async (id: string, data: Partial<AgmTeamMember>): Promise<AgmTeamMember> => (await apiClient.put(`/agm/team/${id}`, data)).data;
export const deleteTeamMember = async (id: string): Promise<{ id: string }> => (await apiClient.delete(`/agm/team/${id}`)).data;
