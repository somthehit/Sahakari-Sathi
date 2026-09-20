import React, { useState, useEffect, useCallback } from 'react';
import { useCoop } from '../../context/CoopContext';
import {
  CalendarDays, Users, Gavel, Megaphone, Plus, Trash2, X, Check, Edit3,
  Loader2, ChevronRight, UserPlus, BookOpen, Eye, EyeOff, AlertTriangle,
  Upload, FileText, Paperclip, Download, Shield, Camera,
} from 'lucide-react';
import {
  fetchMeetings, createMeeting, updateMeeting, deleteMeeting,
  fetchAttendees, addAttendee, bulkAddMembers, updateAttendee, deleteAttendee,
  fetchResolutions, addResolution, updateResolution, deleteResolution,
  fetchNews, createNews, updateNews, deleteNews,
  fetchTeamMembers, addTeamMember, updateTeamMember, deleteTeamMember,
  type AgmMeeting, type AgmAttendee, type AgmResolution, type AgmNewsItem, type AgmAgendaItem, type AgmTeamMember,
} from '../../api/agmManagement';

type Tab = 'meetings' | 'attendees' | 'resolutions' | 'news' | 'team';

const MEETING_TYPES = ['AGM', 'EGM', 'Board', 'Committee', 'Special'];
const MEETING_STATUSES = ['Scheduled', 'In_Progress', 'Completed', 'Cancelled', 'Postponed'];
const RESOLUTION_STATUSES = ['Proposed', 'Approved', 'Rejected', 'Deferred', 'Withdrawn'];
const NEWS_CATEGORIES = ['Notice', 'Circular', 'Announcement', 'Resolution', 'Minutes', 'Report', 'General'];
const NEWS_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const TEAM_CATEGORIES = ['Board', 'Finance', 'Law', 'Loan', 'Audit', 'Supervision', 'Technical', 'Management', 'Other'];
const TEAM_STATUSES = ['Active', 'Inactive', 'Resigned', 'Removed'];

const statusColor = (s: string) => {
  const m: Record<string, string> = {
    Scheduled: 'bg-sky-100 text-sky-700', In_Progress: 'bg-amber-100 text-amber-700',
    Completed: 'bg-emerald-100 text-emerald-700', Cancelled: 'bg-red-100 text-red-700',
    Postponed: 'bg-slate-100 text-slate-600', Proposed: 'bg-sky-100 text-sky-700',
    Approved: 'bg-emerald-100 text-emerald-700', Rejected: 'bg-red-100 text-red-700',
    Deferred: 'bg-amber-100 text-amber-700', Withdrawn: 'bg-slate-100 text-slate-600',
  };
  return m[s] || 'bg-slate-100 text-slate-600';
};
const priorityColor = (p: string) => {
  const m: Record<string, string> = { Low: 'bg-slate-100 text-slate-600', Medium: 'bg-sky-100 text-sky-700', High: 'bg-amber-100 text-amber-700', Urgent: 'bg-red-100 text-red-700' };
  return m[p] || 'bg-slate-100 text-slate-600';
};

export const AgmManagementView: React.FC = () => {
  const { addNotification } = useCoop();
  const [tab, setTab] = useState<Tab>('meetings');
  const [meetings, setMeetings] = useState<AgmMeeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<AgmMeeting | null>(null);
  const [attendees, setAttendees] = useState<AgmAttendee[]>([]);
  const [resolutions, setResolutions] = useState<AgmResolution[]>([]);
  const [news, setNews] = useState<AgmNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [meetingModal, setMeetingModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<AgmMeeting | null>(null);
  const [attendeeModal, setAttendeeModal] = useState(false);
  const [resolutionModal, setResolutionModal] = useState(false);
  const [editingResolution, setEditingResolution] = useState<AgmResolution | null>(null);
  const [newsModal, setNewsModal] = useState(false);
  const [editingNews, setEditingNews] = useState<AgmNewsItem | null>(null);
  // Team state
  const [teamMembers, setTeamMembers] = useState<AgmTeamMember[]>([]);
  const [teamModal, setTeamModal] = useState(false);
  const [editingTeamMember, setEditingTeamMember] = useState<AgmTeamMember | null>(null);
  const [teamCategoryFilter, setTeamCategoryFilter] = useState<string>('All');
  const [tForm, setTForm] = useState({ name: '', nameNepali: '', role: '', category: 'Board', designation: '', phone: '', email: '', address: '', photoUrl: '', joinedDateBs: '', tenureEndBs: '', notes: '', meetingId: '', documents: [] as { name: string; url: string; size?: number; type?: string }[] });

  // Meeting form
  const [mForm, setMForm] = useState({ title: '', titleNepali: '', type: 'AGM', meetingDateBs: '', startTime: '', endTime: '', venue: '', venueNepali: '', description: '', agenda: [] as AgmAgendaItem[], status: 'Scheduled', chairedBy: '', secretaryName: '' });
  // Attendee form
  const [aForm, setAForm] = useState({ memberNo: '', memberName: '', guestName: '', guestRole: '', isGuest: false, remarks: '' });
  // Resolution form
  const [rForm, setRForm] = useState({ title: '', titleNepali: '', description: '', proposedBy: '', secondedBy: '', status: 'Proposed', decision: '', assignedTo: '', attachments: [] as { name: string; url: string; size?: number; type?: string }[] });
  // News form
  const [nForm, setNForm] = useState({ title: '', titleNepali: '', content: '', contentNepali: '', category: 'Announcement', priority: 'Medium', isPublished: false, attachments: [] as { name: string; url: string; size?: number; type?: string }[] });

  const loadMeetings = useCallback(async () => {
    try { setLoading(true); setMeetings(await fetchMeetings()); }
    catch (e: any) { addNotification('Error', e.response?.data?.error || 'Failed to load meetings', 'alert'); }
    finally { setLoading(false); }
  }, [addNotification]);

  const loadAttendees = useCallback(async (meetingId: string) => {
    try { setAttendees(await fetchAttendees(meetingId)); } catch (_) {}
  }, []);

  const loadResolutions = useCallback(async (meetingId: string) => {
    try { setResolutions(await fetchResolutions(meetingId)); } catch (_) {}
  }, []);

  const loadNews = useCallback(async () => {
    try { setNews(await fetchNews()); } catch (_) {}
  }, []);

  useEffect(() => { loadMeetings(); loadNews(); }, [loadMeetings, loadNews]);

  useEffect(() => {
    if (selectedMeeting) {
      loadAttendees(selectedMeeting.id);
      loadResolutions(selectedMeeting.id);
    }
  }, [selectedMeeting, loadAttendees, loadResolutions]);

  // ─── MEETING CRUD ────────────────────────────────────────────────────
  const handleSaveMeeting = async () => {
    if (!mForm.title || !mForm.meetingDateBs) { addNotification('Validation', 'Title and Date are required.', 'alert'); return; }
    try {
      setSaving(true);
      if (editingMeeting) {
        await updateMeeting(editingMeeting.id, mForm);
        addNotification('Updated', 'Meeting updated successfully.', 'success');
      } else {
        const created = await createMeeting(mForm);
        addNotification('Created', 'Meeting created successfully.', 'success');
        setSelectedMeeting(created);
      }
      setMeetingModal(false); setEditingMeeting(null);
      setMForm({ title: '', titleNepali: '', type: 'AGM', meetingDateBs: '', startTime: '', endTime: '', venue: '', venueNepali: '', description: '', agenda: [], status: 'Scheduled', chairedBy: '', secretaryName: '' });
      await loadMeetings();
    } catch (e: any) { addNotification('Error', e.response?.data?.error || 'Failed to save', 'alert'); }
    finally { setSaving(false); }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Delete this meeting and all its attendees/resolutions?')) return;
    try {
      await deleteMeeting(id);
      if (selectedMeeting?.id === id) setSelectedMeeting(null);
      addNotification('Deleted', 'Meeting deleted.', 'success');
      await loadMeetings();
    } catch (e: any) { addNotification('Error', e.response?.data?.error || 'Failed to delete', 'alert'); }
  };

  // ─── ATTENDEE CRUD ───────────────────────────────────────────────────
  const handleAddAttendee = async () => {
    if (!selectedMeeting) return;
    if (!aForm.isGuest && !aForm.memberNo) { addNotification('Validation', 'Member No is required.', 'alert'); return; }
    if (aForm.isGuest && !aForm.guestName) { addNotification('Validation', 'Guest name is required.', 'alert'); return; }
    try {
      setSaving(true);
      await addAttendee(selectedMeeting.id, { ...aForm, meetingId: selectedMeeting.id });
      addNotification('Added', 'Attendee added.', 'success');
      setAttendeeModal(false);
      setAForm({ memberNo: '', memberName: '', guestName: '', guestRole: '', isGuest: false, remarks: '' });
      await loadAttendees(selectedMeeting.id);
    } catch (e: any) { addNotification('Error', e.response?.data?.error || 'Failed', 'alert'); }
    finally { setSaving(false); }
  };

  const handleBulkAdd = async () => {
    if (!selectedMeeting) return;
    try {
      setSaving(true);
      const result = await bulkAddMembers(selectedMeeting.id);
      addNotification('Bulk Add', result.message, 'success');
      await loadAttendees(selectedMeeting.id);
    } catch (e: any) { addNotification('Error', e.response?.data?.error || 'Failed', 'alert'); }
    finally { setSaving(false); }
  };

  const handleToggleAttendance = async (att: AgmAttendee) => {
    try {
      await updateAttendee(att.id, { attended: !att.attended });
      if (selectedMeeting) await loadAttendees(selectedMeeting.id);
    } catch (_) {}
  };

  const handleDeleteAttendee = async (id: string) => {
    if (!confirm('Remove this attendee?')) return;
    try {
      await deleteAttendee(id);
      if (selectedMeeting) await loadAttendees(selectedMeeting.id);
    } catch (_) {}
  };

  // ─── RESOLUTION CRUD ─────────────────────────────────────────────────
  const handleSaveResolution = async () => {
    if (!selectedMeeting || !rForm.title) { addNotification('Validation', 'Title is required.', 'alert'); return; }
    try {
      setSaving(true);
      if (editingResolution) {
        await updateResolution(editingResolution.id, rForm);
        addNotification('Updated', 'Resolution updated.', 'success');
      } else {
        await addResolution(selectedMeeting.id, { ...rForm, meetingId: selectedMeeting.id });
        addNotification('Added', 'Resolution added.', 'success');
      }
      setResolutionModal(false); setEditingResolution(null);
      setRForm({ title: '', titleNepali: '', description: '', proposedBy: '', secondedBy: '', status: 'Proposed', decision: '', assignedTo: '', attachments: [] });
      await loadResolutions(selectedMeeting.id);
    } catch (e: any) { addNotification('Error', e.response?.data?.error || 'Failed', 'alert'); }
    finally { setSaving(false); }
  };

  const handleDeleteResolution = async (id: string) => {
    if (!confirm('Delete this resolution?')) return;
    try {
      await deleteResolution(id);
      if (selectedMeeting) await loadResolutions(selectedMeeting.id);
    } catch (_) {}
  };

  // ─── FILE UPLOAD FOR RESOLUTIONS ────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          setSaving(true);
          const dataUrl = reader.result as string;
          const { apiClient } = await import('../../lib/apiClient');
          const result = await apiClient.post('/uploads', {
            targetType: 'agm_document',
            dataUrl,
            fileName: file.name,
          });
          const attachment = { name: file.name, url: result.data.storagePath || result.data.url, size: file.size, type: file.type };
          setRForm(prev => ({ ...prev, attachments: [...prev.attachments, attachment] }));
        } catch (err: any) {
          addNotification('Upload Failed', err.response?.data?.error || err.message || 'Failed to upload file', 'alert');
        } finally { setSaving(false); }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // ─── NEWS CRUD ───────────────────────────────────────────────────────
  const handleSaveNews = async () => {
    if (!nForm.title) { addNotification('Validation', 'Title is required.', 'alert'); return; }
    try {
      setSaving(true);
      if (editingNews) {
        await updateNews(editingNews.id, nForm);
        addNotification('Updated', 'News updated.', 'success');
      } else {
        await createNews(nForm);
        addNotification('Created', 'News created.', 'success');
      }
      setNewsModal(false); setEditingNews(null);
      setNForm({ title: '', titleNepali: '', content: '', contentNepali: '', category: 'Announcement', priority: 'Medium', isPublished: false, attachments: [] });
      await loadNews();
    } catch (e: any) { addNotification('Error', e.response?.data?.error || 'Failed', 'alert'); }
    finally { setSaving(false); }
  };

  const handleDeleteNews = async (id: string) => {
    if (!confirm('Delete this news?')) return;
    try { await deleteNews(id); await loadNews(); } catch (_) {}
  };

  const handleNewsFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const { apiClient } = await import('../../lib/apiClient');
          const result = await apiClient.post('/uploads', { targetType: 'agm_document', dataUrl: reader.result as string, fileName: file.name });
          const attachment = { name: file.name, url: result.data.storagePath || result.data.url, size: file.size, type: file.type };
          setNForm(prev => ({ ...prev, attachments: [...prev.attachments, attachment] }));
        } catch (err: any) {
          addNotification('Upload Failed', err.message || 'Failed to upload file', 'alert');
        } finally { setSaving(false); }
      };
      reader.readAsDataURL(file);
    } catch (_) {}
    e.target.value = '';
  };

  // ─── TEAM CRUD ────────────────────────────────────────────────────────
  const loadTeam = useCallback(async (cat?: string) => {
    try { setTeamMembers(await fetchTeamMembers(cat === 'All' ? undefined : cat)); } catch (_) {}
  }, []);

  useEffect(() => { loadTeam(teamCategoryFilter); }, [loadTeam, teamCategoryFilter]);

  const handleSaveTeamMember = async () => {
    if (!tForm.name || !tForm.role) { addNotification('Validation', 'Name and Role are required.', 'alert'); return; }
    try {
      setSaving(true);
      if (editingTeamMember) {
        await updateTeamMember(editingTeamMember.id, tForm);
        addNotification('Updated', 'Team member updated.', 'success');
      } else {
        await addTeamMember(tForm);
        addNotification('Created', 'Team member added.', 'success');
      }
      setTeamModal(false); setEditingTeamMember(null);
      setTForm({ name: '', nameNepali: '', role: '', category: 'Board', designation: '', phone: '', email: '', address: '', photoUrl: '', joinedDateBs: '', tenureEndBs: '', notes: '', meetingId: '', documents: [] });
      await loadTeam(teamCategoryFilter);
    } catch (e: any) { addNotification('Error', e.response?.data?.error || 'Failed', 'alert'); }
    finally { setSaving(false); }
  };

  const handleDeleteTeamMember = async (id: string) => {
    if (!confirm('Delete this team member?')) return;
    try {
      await deleteTeamMember(id);
      addNotification('Deleted', 'Team member removed.', 'success');
      await loadTeam(teamCategoryFilter);
    } catch (e: any) { addNotification('Error', e.response?.data?.error || 'Failed', 'alert'); }
  };

  const handleTeamPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const { apiClient } = await import('../../lib/apiClient');
          const result = await apiClient.post('/uploads', { targetType: 'photo', dataUrl: reader.result as string, fileName: file.name });
          setTForm(prev => ({ ...prev, photoUrl: result.data.storagePath || result.data.url }));
        } catch (err: any) {
          addNotification('Upload Failed', err.message || 'Failed to upload photo', 'alert');
        } finally { setSaving(false); }
      };
      reader.readAsDataURL(file);
    } catch (_) {}
    e.target.value = '';
  };

  const handleTeamDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const { apiClient } = await import('../../lib/apiClient');
          const result = await apiClient.post('/uploads', { targetType: 'agm_document', dataUrl: reader.result as string, fileName: file.name });
          const doc = { name: file.name, url: result.data.storagePath || result.data.url, size: file.size, type: file.type };
          setTForm(prev => ({ ...prev, documents: [...prev.documents, doc] }));
        } catch (err: any) {
          addNotification('Upload Failed', err.message || 'Failed to upload document', 'alert');
        } finally { setSaving(false); }
      };
      reader.readAsDataURL(file);
    } catch (_) {}
    e.target.value = '';
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'meetings', label: 'Meetings', icon: <CalendarDays className="w-3.5 h-3.5" /> },
    { key: 'team', label: 'Team', icon: <Shield className="w-3.5 h-3.5" /> },
    { key: 'attendees', label: 'Attendance', icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'resolutions', label: 'Resolutions', icon: <Gavel className="w-3.5 h-3.5" /> },
    { key: 'news', label: 'News & Updates', icon: <Megaphone className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">AGM Management (साधारण सभा व्यवस्थापन)</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Manage meetings, team, attendance, resolutions, and news updates.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${tab === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ─── MEETINGS TAB ──────────────────────────────────────────── */}
      {tab === 'meetings' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditingMeeting(null); setMForm({ title: '', titleNepali: '', type: 'AGM', meetingDateBs: '', startTime: '', endTime: '', venue: '', venueNepali: '', description: '', agenda: [], status: 'Scheduled', chairedBy: '', secretaryName: '' }); setMeetingModal(true); }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-sm">
              <Plus className="w-3.5 h-3.5" />Add Meeting
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
          ) : meetings.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-semibold">No meetings found</p>
              <p className="text-slate-400 text-[11px] mt-1">Create your first meeting to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {meetings.map(m => (
                <div key={m.id} className={`bg-white p-4 rounded-2xl border-2 shadow-sm transition cursor-pointer ${selectedMeeting?.id === m.id ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-slate-300'}`}
                  onClick={() => setSelectedMeeting(m)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">{m.type}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(m.status)}`}>{m.status.replace('_', ' ')}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">{m.title}</h3>
                      {m.titleNepali && <p className="text-slate-500 text-[11px]">{m.titleNepali}</p>}
                      <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-slate-500">
                        <span>Date: <b className="text-slate-700">{m.meetingDateBs}</b></span>
                        {m.startTime && <span>Time: <b className="text-slate-700">{m.startTime}{m.endTime ? ` - ${m.endTime}` : ''}</b></span>}
                        {m.venue && <span>Venue: <b className="text-slate-700">{m.venue}</b></span>}
                        {m.chairedBy && <span>Chair: <b className="text-slate-700">{m.chairedBy}</b></span>}
                        {Array.isArray(m.agenda) && m.agenda.length > 0 && <span>Agenda: <b className="text-emerald-700">{m.agenda.length} item{m.agenda.length !== 1 ? 's' : ''}</b></span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setEditingMeeting(m); setMForm({ title: m.title, titleNepali: m.titleNepali || '', type: m.type, meetingDateBs: m.meetingDateBs, startTime: m.startTime || '', endTime: m.endTime || '', venue: m.venue || '', venueNepali: m.venueNepali || '', description: m.description || '', agenda: (m.agenda as AgmAgendaItem[]) || [], status: m.status, chairedBy: m.chairedBy || '', secretaryName: m.secretaryName || '' }); setMeetingModal(true); }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer" title="Edit">
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteMeeting(m.id); }}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition cursor-pointer" title="Delete">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TEAM TAB ──────────────────────────────────────────────── */}
      {tab === 'team' && (
        <div className="space-y-4">
          {/* Category filter + Add button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {['All', ...TEAM_CATEGORIES].map(cat => (
                <button key={cat} onClick={() => setTeamCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${teamCategoryFilter === cat ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {cat}
                </button>
              ))}
            </div>
            <button onClick={() => { setEditingTeamMember(null); setTForm({ name: '', nameNepali: '', role: '', category: 'Board', designation: '', phone: '', email: '', address: '', photoUrl: '', joinedDateBs: '', tenureEndBs: '', notes: '', meetingId: '', documents: [] }); setTeamModal(true); }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-sm">
              <Plus className="w-3.5 h-3.5" />Add Team Member
            </button>
          </div>

          {/* Team grid */}
          {teamMembers.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-semibold">No team members found</p>
              <p className="text-slate-400 text-[11px] mt-1">Add board members, committee members, or staff.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamMembers.map(tm => (
                <div key={tm.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start gap-4">
                    {/* Photo */}
                    <div className="flex-shrink-0">
                      {tm.photoUrl ? (
                        <img src={tm.photoUrl} alt={tm.name} className="w-16 h-16 rounded-full object-cover border-2 border-emerald-200" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-emerald-200">
                          <span className="text-lg font-black text-emerald-700">{tm.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-slate-900 text-sm truncate">{tm.name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${tm.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{tm.status}</span>
                      </div>
                      {tm.nameNepali && <p className="text-slate-500 text-[11px]">{tm.nameNepali}</p>}
                      <p className="text-emerald-700 text-[11px] font-bold mt-0.5">{tm.role}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">{tm.category}</span>
                        {tm.designation && <span className="text-[10px] text-slate-500">{tm.designation}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-slate-500">
                        {tm.phone && <span>{tm.phone}</span>}
                        {tm.email && <span>{tm.email}</span>}
                      </div>
                      {tm.joinedDateBs && <p className="text-[10px] text-slate-400 mt-1">Joined: {tm.joinedDateBs}</p>}
                      {tm.documents && tm.documents.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {tm.documents.slice(0, 3).map((d, i) => (
                            <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-600 hover:underline flex items-center gap-0.5">
                              <FileText className="w-3 h-3" />{d.name.slice(0, 15)}
                            </a>
                          ))}
                          {tm.documents.length > 3 && <span className="text-[10px] text-slate-400">+{tm.documents.length - 3}</span>}
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingTeamMember(tm); setTForm({ name: tm.name, nameNepali: tm.nameNepali || '', role: tm.role, category: tm.category, designation: tm.designation || '', phone: tm.phone || '', email: tm.email || '', address: tm.address || '', photoUrl: tm.photoUrl || '', joinedDateBs: tm.joinedDateBs || '', tenureEndBs: tm.tenureEndBs || '', notes: tm.notes || '', meetingId: tm.meetingId || '', documents: tm.documents || [] }); setTeamModal(true); }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer" title="Edit">
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button onClick={() => handleDeleteTeamMember(tm.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition cursor-pointer" title="Delete">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── ATTENDEES TAB ────────────────────────────────────────── */}
      {tab === 'attendees' && (
        <div className="space-y-4">
          {!selectedMeeting ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-semibold">Select a meeting first</p>
              <p className="text-slate-400 text-[11px] mt-1">Go to Meetings tab and click on a meeting.</p>
            </div>
          ) : (
            <>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-semibold">
                Managing attendance for: <b>{selectedMeeting.title}</b> ({selectedMeeting.meetingDateBs})
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setAForm({ memberNo: '', memberName: '', guestName: '', guestRole: '', isGuest: false, remarks: '' }); setAttendeeModal(true); }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-sm">
                  <UserPlus className="w-3.5 h-3.5" />Add Attendee
                </button>
                <button onClick={handleBulkAdd} disabled={saving}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-sm disabled:opacity-50">
                  <Users className="w-3.5 h-3.5" />{saving ? 'Adding…' : 'Add All Active Members'}
                </button>
              </div>
              {/* Attendance Summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Added', value: attendees.length, color: 'text-slate-900' },
                  { label: 'Present', value: attendees.filter(a => a.attended).length, color: 'text-emerald-700' },
                  { label: 'Guests', value: attendees.filter(a => a.isGuest).length, color: 'text-amber-700' },
                ].map((c, i) => (
                  <div key={i} className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">{c.label}</p>
                    <p className={`text-xl font-black ${c.color} mt-1`}>{c.value}</p>
                  </div>
                ))}
              </div>
              {/* Attendee List */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] font-semibold">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Member No</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-center">Present</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendees.map((a, i) => (
                      <tr key={a.id} className="hover:bg-slate-50/80">
                        <td className="p-3 text-slate-400">{i + 1}</td>
                        <td className="p-3 font-semibold text-slate-900">{a.isGuest ? a.guestName : a.memberName}</td>
                        <td className="p-3 font-mono text-slate-600">{a.isGuest ? a.guestRole : a.memberNo}</td>
                        <td className="p-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.isGuest ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                            {a.isGuest ? 'Guest' : 'Member'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button onClick={() => handleToggleAttendance(a)}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition cursor-pointer ${a.attended ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}>
                            {a.attended && <Check className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="p-3">
                          <button onClick={() => handleDeleteAttendee(a.id)} className="p-1 hover:bg-red-50 rounded-lg transition cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── RESOLUTIONS TAB ──────────────────────────────────────── */}
      {tab === 'resolutions' && (
        <div className="space-y-4">
          {!selectedMeeting ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <Gavel className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-semibold">Select a meeting first</p>
              <p className="text-slate-400 text-[11px] mt-1">Go to Meetings tab and click on a meeting.</p>
            </div>
          ) : (
            <>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-semibold">
                Resolutions for: <b>{selectedMeeting.title}</b> ({selectedMeeting.meetingDateBs})
              </div>
              <button onClick={() => { setEditingResolution(null); setRForm({ title: '', titleNepali: '', description: '', proposedBy: '', secondedBy: '', status: 'Proposed', decision: '', assignedTo: '', attachments: [] }); setResolutionModal(true); }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-sm">
                <Plus className="w-3.5 h-3.5" />Add Resolution
              </button>
              {resolutions.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                  <p className="text-slate-400">No resolutions yet.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {resolutions.map(r => (
                    <div key={r.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">#{r.resolutionNo}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>{r.status}</span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm">{r.title}</h3>
                          {r.description && <p className="text-slate-500 text-[11px] mt-1">{r.description}</p>}
                          <div className="flex gap-3 mt-2 text-[11px] text-slate-500">
                            {r.proposedBy && <span>Proposed by: <b>{r.proposedBy}</b></span>}
                            {r.secondedBy && <span>Seconded by: <b>{r.secondedBy}</b></span>}
                            {r.assignedTo && <span>Assigned to: <b>{r.assignedTo}</b></span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingResolution(r); setRForm({ title: r.title, titleNepali: r.titleNepali || '', description: r.description || '', proposedBy: r.proposedBy || '', secondedBy: r.secondedBy || '', status: r.status, decision: r.decision || '', assignedTo: r.assignedTo || '', attachments: (r.attachments as any) || [] }); setResolutionModal(true); }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer">
                            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                          <button onClick={() => handleDeleteResolution(r.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── NEWS TAB ─────────────────────────────────────────────── */}
      {tab === 'news' && (
        <div className="space-y-4">
          <button onClick={() => { setEditingNews(null); setNForm({ title: '', titleNepali: '', content: '', contentNepali: '', category: 'Announcement', priority: 'Medium', isPublished: false }); setNewsModal(true); }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-sm">
            <Plus className="w-3.5 h-3.5" />Add News / Update
          </button>
          {news.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-semibold">No news published yet</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {news.map(n => (
                <div key={n.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityColor(n.priority)}`}>{n.priority}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{n.category}</span>
                        {n.isPublished ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />Published</span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-0.5"><EyeOff className="w-2.5 h-2.5" />Draft</span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">{n.title}</h3>
                      {n.titleNepali && <p className="text-slate-500 text-[11px]">{n.titleNepali}</p>}
                      {n.content && <p className="text-slate-600 text-[11px] mt-1 line-clamp-2">{n.content}</p>}
                      {n.publishDateBs && <p className="text-slate-400 text-[10px] mt-1">Published: {n.publishDateBs}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingNews(n); setNForm({ title: n.title, titleNepali: n.titleNepali || '', content: n.content || '', contentNepali: n.contentNepali || '', category: n.category, priority: n.priority, isPublished: n.isPublished || false, attachments: n.attachments || [] }); setNewsModal(true); }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer">
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button onClick={() => handleDeleteNews(n.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODALS ────────────────────────────────────────────────── */}

      {/* Meeting Modal */}
      {meetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMeetingModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-900">{editingMeeting ? 'Edit Meeting' : 'New Meeting'}</h2>
              <button onClick={() => setMeetingModal(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Title *</label>
                <input value={mForm.title} onChange={e => setMForm({ ...mForm, title: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" placeholder="Annual General Meeting" /></div>
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Title (Nepali)</label>
                <input value={mForm.titleNepali} onChange={e => setMForm({ ...mForm, titleNepali: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Type</label>
                  <select value={mForm.type} onChange={e => setMForm({ ...mForm, type: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none">
                    {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Status</label>
                  <select value={mForm.status} onChange={e => setMForm({ ...mForm, status: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none">
                    {MEETING_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Date (BS) *</label>
                  <input value={mForm.meetingDateBs} onChange={e => setMForm({ ...mForm, meetingDateBs: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" placeholder="2083-04-15" /></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Venue</label>
                  <input value={mForm.venue} onChange={e => setMForm({ ...mForm, venue: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Start Time</label>
                  <input type="time" value={mForm.startTime} onChange={e => setMForm({ ...mForm, startTime: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">End Time</label>
                  <input type="time" value={mForm.endTime} onChange={e => setMForm({ ...mForm, endTime: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Chaired By</label>
                  <input value={mForm.chairedBy} onChange={e => setMForm({ ...mForm, chairedBy: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Secretary</label>
                  <input value={mForm.secretaryName} onChange={e => setMForm({ ...mForm, secretaryName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              </div>
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Description</label>
                <textarea value={mForm.description} onChange={e => setMForm({ ...mForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              {/* ─── AGENDA EDITOR ─── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-slate-600 font-semibold text-[11px]">Meeting Agenda</label>
                  <button type="button" onClick={() => {
                    const nextOrder = mForm.agenda.length + 1;
                    setMForm({ ...mForm, agenda: [...mForm.agenda, { order: nextOrder, title: '', titleNepali: '', description: '', type: 'General' }] });
                  }} className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg transition cursor-pointer">
                    <Plus className="w-3 h-3" />Add Item
                  </button>
                </div>
                {mForm.agenda.length === 0 ? (
                  <p className="text-slate-400 text-[11px] italic">No agenda items added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {mForm.agenda.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                          <input value={item.title} onChange={e => {
                            const updated = [...mForm.agenda]; updated[idx] = { ...updated[idx], title: e.target.value };
                            setMForm({ ...mForm, agenda: updated });
                          }} className="flex-1 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:border-emerald-500 focus:outline-none" placeholder="Agenda item title" />
                          <select value={item.type} onChange={e => {
                            const updated = [...mForm.agenda]; updated[idx] = { ...updated[idx], type: e.target.value };
                            setMForm({ ...mForm, agenda: updated });
                          }} className="px-2 py-1 border border-slate-200 rounded-lg text-[10px] focus:border-emerald-500 focus:outline-none">
                            <option value="General">General</option>
                            <option value="Financial">Financial</option>
                            <option value="Election">Election</option>
                            <option value="Resolution">Resolution</option>
                            <option value="Discussion">Discussion</option>
                            <option value="Presentation">Presentation</option>
                          </select>
                          {idx > 0 && (
                            <button type="button" onClick={() => {
                              const updated = [...mForm.agenda];
                              [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                              setMForm({ ...mForm, agenda: updated });
                            }} className="p-1 hover:bg-slate-200 rounded cursor-pointer" title="Move up">
                              <ChevronRight className="w-3 h-3 text-slate-500 rotate-[-90deg]" />
                            </button>
                          )}
                          {idx < mForm.agenda.length - 1 && (
                            <button type="button" onClick={() => {
                              const updated = [...mForm.agenda];
                              [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                              setMForm({ ...mForm, agenda: updated });
                            }} className="p-1 hover:bg-slate-200 rounded cursor-pointer" title="Move down">
                              <ChevronRight className="w-3 h-3 text-slate-500 rotate-[90deg]" />
                            </button>
                          )}
                          <button type="button" onClick={() => {
                            const updated = mForm.agenda.filter((_, i) => i !== idx).map((a, i) => ({ ...a, order: i + 1 }));
                            setMForm({ ...mForm, agenda: updated });
                          }} className="p-1 hover:bg-red-50 rounded cursor-pointer" title="Remove">
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                        <input value={item.titleNepali || ''} onChange={e => {
                          const updated = [...mForm.agenda]; updated[idx] = { ...updated[idx], titleNepali: e.target.value };
                          setMForm({ ...mForm, agenda: updated });
                        }} className="w-full px-2 py-1 border border-slate-200 rounded-lg text-[10px] focus:border-emerald-500 focus:outline-none" placeholder="Nepali title (optional)" />
                        <input value={item.description || ''} onChange={e => {
                          const updated = [...mForm.agenda]; updated[idx] = { ...updated[idx], description: e.target.value };
                          setMForm({ ...mForm, agenda: updated });
                        }} className="w-full px-2 py-1 border border-slate-200 rounded-lg text-[10px] focus:border-emerald-500 focus:outline-none" placeholder="Brief description (optional)" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
              <button onClick={() => setMeetingModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs">Cancel</button>
              <button onClick={handleSaveMeeting} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer text-xs disabled:opacity-50 flex items-center gap-1.5">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{editingMeeting ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendee Modal */}
      {attendeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAttendeeModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-900">Add Attendee</h2>
              <button onClick={() => setAttendeeModal(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={aForm.isGuest} onChange={e => setAForm({ ...aForm, isGuest: e.target.checked })} className="rounded border-slate-300" />
                  <span className="text-xs font-semibold text-slate-700">Guest / Non-member</span>
                </label>
              </div>
              {aForm.isGuest ? (
                <>
                  <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Guest Name *</label>
                    <input value={aForm.guestName} onChange={e => setAForm({ ...aForm, guestName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
                  <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Role / Organization</label>
                    <input value={aForm.guestRole} onChange={e => setAForm({ ...aForm, guestRole: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" placeholder="e.g. Auditor, Legal Advisor" /></div>
                </>
              ) : (
                <>
                  <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Member No *</label>
                    <input value={aForm.memberNo} onChange={e => setAForm({ ...aForm, memberNo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" placeholder="e.g. MEM-001" /></div>
                  <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Full Name</label>
                    <input value={aForm.memberName} onChange={e => setAForm({ ...aForm, memberName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
                </>
              )}
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Remarks</label>
                <input value={aForm.remarks} onChange={e => setAForm({ ...aForm, remarks: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
              <button onClick={() => setAttendeeModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs">Cancel</button>
              <button onClick={handleAddAttendee} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer text-xs disabled:opacity-50">
                {saving ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolution Modal */}
      {resolutionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResolutionModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-900">{editingResolution ? 'Edit Resolution' : 'New Resolution'}</h2>
              <button onClick={() => setResolutionModal(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Title *</label>
                <input value={rForm.title} onChange={e => setRForm({ ...rForm, title: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" placeholder="Dividend Declaration for FY 2083/84" /></div>
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Title (Nepali)</label>
                <input value={rForm.titleNepali} onChange={e => setRForm({ ...rForm, titleNepali: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Description</label>
                <textarea value={rForm.description} onChange={e => setRForm({ ...rForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Proposed By</label>
                  <input value={rForm.proposedBy} onChange={e => setRForm({ ...rForm, proposedBy: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Seconded By</label>
                  <input value={rForm.secondedBy} onChange={e => setRForm({ ...rForm, secondedBy: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Status</label>
                  <select value={rForm.status} onChange={e => setRForm({ ...rForm, status: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none">
                    {RESOLUTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Assigned To</label>
                  <input value={rForm.assignedTo} onChange={e => setRForm({ ...rForm, assignedTo: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              </div>
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Decision / Outcome</label>
                <textarea value={rForm.decision} onChange={e => setRForm({ ...rForm, decision: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              {/* ─── FILE ATTACHMENTS ─── */}
              <div>
                <label className="block text-slate-600 font-semibold text-[11px] mb-1">Physical Document Attachments</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-emerald-300 transition">
                  <label className="flex flex-col items-center gap-2 cursor-pointer">
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="text-[11px] text-slate-500 font-semibold">Click to upload scanned resolution / signed document</span>
                    <span className="text-[10px] text-slate-400">PDF, JPG, PNG up to 10MB</span>
                    <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
                {rForm.attachments.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {rForm.attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{att.name}</p>
                          <p className="text-[10px] text-slate-400">{att.size ? `${(att.size / 1024).toFixed(1)} KB` : ''}</p>
                        </div>
                        <a href={`/api/v1/uploads/${att.url}`} target="_blank" rel="noopener noreferrer"
                          className="p-1 hover:bg-slate-200 rounded transition" title="View">
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                        </a>
                        <button type="button" onClick={() => {
                          setRForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }));
                        }} className="p-1 hover:bg-red-50 rounded transition cursor-pointer" title="Remove">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
              <button onClick={() => setResolutionModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs">Cancel</button>
              <button onClick={handleSaveResolution} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer text-xs disabled:opacity-50">
                {saving ? 'Saving…' : editingResolution ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* News Modal */}
      {newsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setNewsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-900">{editingNews ? 'Edit News' : 'New News / Update'}</h2>
              <button onClick={() => setNewsModal(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Title *</label>
                <input value={nForm.title} onChange={e => setNForm({ ...nForm, title: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Title (Nepali)</label>
                <input value={nForm.titleNepali} onChange={e => setNForm({ ...nForm, titleNepali: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Category</label>
                  <select value={nForm.category} onChange={e => setNForm({ ...nForm, category: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none">
                    {NEWS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Priority</label>
                  <select value={nForm.priority} onChange={e => setNForm({ ...nForm, priority: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none">
                    {NEWS_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select></div>
              </div>
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Content (English)</label>
                <textarea value={nForm.content} onChange={e => setNForm({ ...nForm, content: e.target.value })} rows={4} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Content (Nepali)</label>
                <textarea value={nForm.contentNepali} onChange={e => setNForm({ ...nForm, contentNepali: e.target.value })} rows={4} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              {/* Attachments */}
              <div>
                <label className="block text-slate-600 font-semibold text-[11px] mb-1">Attachments</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {nForm.attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px]">
                      <FileText className="w-3 h-3 text-slate-400" />
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-slate-700 font-semibold hover:underline truncate max-w-[120px]">{att.name}</a>
                      <button onClick={() => setNForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <label className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-[10px] font-bold text-emerald-700 cursor-pointer hover:bg-emerald-100">
                    <Upload className="w-3 h-3" />Upload
                    <input type="file" onChange={handleNewsFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={nForm.isPublished} onChange={e => setNForm({ ...nForm, isPublished: e.target.checked })} className="rounded border-slate-300" />
                <span className="text-xs font-semibold text-slate-700">Published</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
              <button onClick={() => setNewsModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs">Cancel</button>
              <button onClick={handleSaveNews} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer text-xs disabled:opacity-50">
                {saving ? 'Saving…' : editingNews ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {teamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setTeamModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-900">{editingTeamMember ? 'Edit Team Member' : 'Add Team Member'}</h2>
              <button onClick={() => setTeamModal(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {tForm.photoUrl ? (
                    <img src={tForm.photoUrl} alt="Photo" className="w-20 h-20 rounded-full object-cover border-2 border-emerald-200" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-emerald-200">
                      <Camera className="w-6 h-6 text-emerald-400" />
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 bg-emerald-600 text-white rounded-full p-1.5 cursor-pointer hover:bg-emerald-700">
                    <Camera className="w-3 h-3" />
                    <input type="file" accept="image/*" onChange={handleTeamPhotoUpload} className="hidden" />
                  </label>
                </div>
                <div className="text-[11px] text-slate-500">Upload a passport-size photo</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Full Name *</label>
                  <input value={tForm.name} onChange={e => setTForm({ ...tForm, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Name (Nepali)</label>
                  <input value={tForm.nameNepali} onChange={e => setTForm({ ...tForm, nameNepali: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Role / Position *</label>
                  <input value={tForm.role} onChange={e => setTForm({ ...tForm, role: e.target.value })} placeholder="e.g. Chairperson, Treasurer, Advisor" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Category</label>
                  <select value={tForm.category} onChange={e => setTForm({ ...tForm, category: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none">
                    {TEAM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Designation</label>
                  <input value={tForm.designation} onChange={e => setTForm({ ...tForm, designation: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Phone</label>
                  <input value={tForm.phone} onChange={e => setTForm({ ...tForm, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Email</label>
                  <input type="email" value={tForm.email} onChange={e => setTForm({ ...tForm, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Address</label>
                  <input value={tForm.address} onChange={e => setTForm({ ...tForm, address: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Joined Date (BS)</label>
                  <input value={tForm.joinedDateBs} onChange={e => setTForm({ ...tForm, joinedDateBs: e.target.value })} placeholder="2080-01-01" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
                <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Tenure End (BS)</label>
                  <input value={tForm.tenureEndBs} onChange={e => setTForm({ ...tForm, tenureEndBs: e.target.value })} placeholder="2084-01-01" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>
              </div>

              <div><label className="block text-slate-600 font-semibold text-[11px] mb-1">Notes</label>
                <textarea value={tForm.notes} onChange={e => setTForm({ ...tForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" /></div>

              {/* Documents */}
              <div>
                <label className="block text-slate-600 font-semibold text-[11px] mb-1">Documents</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {tForm.documents.map((d, i) => (
                    <div key={i} className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px]">
                      <FileText className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-700 font-semibold truncate max-w-[100px]">{d.name}</span>
                      <button onClick={() => setTForm(prev => ({ ...prev, documents: prev.documents.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <label className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-[10px] font-bold text-emerald-700 cursor-pointer hover:bg-emerald-100">
                    <Upload className="w-3 h-3" />Upload
                    <input type="file" onChange={handleTeamDocUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
              <button onClick={() => setTeamModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs">Cancel</button>
              <button onClick={handleSaveTeamMember} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer text-xs disabled:opacity-50">
                {saving ? 'Saving…' : editingTeamMember ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
