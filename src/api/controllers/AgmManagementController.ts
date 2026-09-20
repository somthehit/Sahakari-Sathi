/**
 * AgmManagementController
 * CRUD operations for AGM meetings, attendees, resolutions, and news.
 */
import { Request, Response } from 'express';
import { and, eq, sql, desc } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { agmMeetings, agmAttendees, agmResolutions, agmNews, agmTeamMembers } from '../../db/schema/governance';
import { members } from '../../db/schema/members';

interface OrgUser {
  organizationId?: string;
  username?: string;
}

// ══════════════════════════════════════════════════════════════════════
// MEETINGS
// ══════════════════════════════════════════════════════════════════════
export class AgmManagementController {

  // ─── MEETINGS ────────────────────────────────────────────────────────
  static async getMeetings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const meetings = await db.select().from(agmMeetings)
        .where(eq(agmMeetings.organizationId, organizationId))
        .orderBy(desc(agmMeetings.meetingDateBs));
      res.json(meetings);
    } catch (error: any) {
      console.error('AgmManagementController.getMeetings:', error);
      res.status(500).json({ error: error.message || 'Failed to load meetings.' });
    }
  }

  static async getMeeting(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const [meeting] = await db.select().from(agmMeetings)
        .where(and(eq(agmMeetings.id, id), eq(agmMeetings.organizationId, organizationId)))
        .limit(1);
      if (!meeting) return res.status(404).json({ error: 'Meeting not found.' });
      res.json(meeting);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createMeeting(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const body = req.body;
      const [created] = await db.insert(agmMeetings).values({
        organizationId,
        title: body.title,
        titleNepali: body.titleNepali,
        type: body.type || 'AGM',
        meetingDateBs: body.meetingDateBs,
        meetingDateAd: body.meetingDateAd,
        startTime: body.startTime,
        endTime: body.endTime,
        venue: body.venue,
        venueNepali: body.venueNepali,
        description: body.description,
        agenda: body.agenda || [],
        status: body.status || 'Scheduled',
        quorumRequired: body.quorumRequired,
        quorumPercentage: body.quorumPercentage || 50,
        calledBy: body.calledBy,
        chairedBy: body.chairedBy,
        secretaryName: body.secretaryName,
        createdBy: req.user?.username,
      }).returning();
      res.status(201).json(created);
    } catch (error: any) {
      console.error('AgmManagementController.createMeeting:', error);
      res.status(500).json({ error: error.message || 'Failed to create meeting.' });
    }
  }

  static async updateMeeting(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const body = req.body;
      const [updated] = await db.update(agmMeetings).set({
        ...body,
        updatedAt: new Date(),
      }).where(and(eq(agmMeetings.id, id), eq(agmMeetings.organizationId, organizationId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Meeting not found.' });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteMeeting(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      // Delete attendees and resolutions first
      await db.delete(agmAttendees).where(eq(agmAttendees.meetingId, id));
      await db.delete(agmResolutions).where(eq(agmResolutions.meetingId, id));
      const [deleted] = await db.delete(agmMeetings)
        .where(and(eq(agmMeetings.id, id), eq(agmMeetings.organizationId, organizationId)))
        .returning();
      if (!deleted) return res.status(404).json({ error: 'Meeting not found.' });
      res.json({ message: 'Meeting deleted.', id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ─── AGENDA (dedicated update) ──────────────────────────────────────
  static async updateAgenda(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const { agenda } = req.body;
      if (!Array.isArray(agenda)) return res.status(400).json({ error: 'agenda must be an array.' });
      const [updated] = await db.update(agmMeetings).set({ agenda, updatedAt: new Date() })
        .where(and(eq(agmMeetings.id, id), eq(agmMeetings.organizationId, organizationId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Meeting not found.' });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ─── ATTENDEES ───────────────────────────────────────────────────────
  static async getAttendees(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { meetingId } = req.params;
      const attendees = await db.select().from(agmAttendees)
        .where(and(eq(agmAttendees.meetingId, meetingId), eq(agmAttendees.organizationId, organizationId)))
        .orderBy(agmAttendees.memberNo);
      res.json(attendees);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async addAttendee(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const body = req.body;

      // If memberId provided, fetch member details
      let memberNo = body.memberNo;
      let memberName = body.memberName;
      if (body.memberId && !memberName) {
        const [m] = await db.select().from(members)
          .where(eq(members.id, body.memberId)).limit(1);
        if (m) { memberNo = m.memberNo; memberName = m.fullName; }
      }

      const [created] = await db.insert(agmAttendees).values({
        organizationId,
        meetingId: body.meetingId,
        memberId: body.memberId,
        memberNo,
        memberName,
        isGuest: body.isGuest || false,
        guestName: body.guestName,
        guestRole: body.guestRole,
        attended: body.attended || false,
        proxyGiven: body.proxyGiven || false,
        proxyTo: body.proxyTo,
        remarks: body.remarks,
        createdBy: req.user?.username,
      }).returning();
      res.status(201).json(created);
    } catch (error: any) {
      console.error('AgmManagementController.addAttendee:', error);
      res.status(500).json({ error: error.message || 'Failed to add attendee.' });
    }
  }

  static async updateAttendee(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const [updated] = await db.update(agmAttendees).set(req.body)
        .where(and(eq(agmAttendees.id, id), eq(agmAttendees.organizationId, organizationId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Attendee not found.' });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteAttendee(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      await db.delete(agmAttendees)
        .where(and(eq(agmAttendees.id, id), eq(agmAttendees.organizationId, organizationId)));
      res.json({ message: 'Attendee removed.', id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkAddMembers(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { meetingId } = req.params;

      // Fetch all active members
      const activeMembers = await db.select().from(members)
        .where(and(eq(members.organizationId, organizationId), eq(members.status, 'Active')));

      // Get existing attendee member IDs for this meeting
      const existing = await db.select({ memberId: agmAttendees.memberId }).from(agmAttendees)
        .where(eq(agmAttendees.meetingId, meetingId));
      const existingIds = new Set(existing.map((e: any) => e.memberId).filter(Boolean));

      const newMembers = activeMembers.filter((m: any) => !existingIds.has(m.id));
      if (newMembers.length === 0) return res.json({ message: 'All active members already added.', added: 0 });

      const values = newMembers.map((m: any) => ({
        organizationId,
        meetingId,
        memberId: m.id,
        memberNo: m.memberNo,
        memberName: m.fullName,
        isGuest: false,
        attended: false,
        proxyGiven: false,
        createdBy: req.user?.username,
      }));

      const added = await db.insert(agmAttendees).values(values).returning();
      res.status(201).json({ message: `Added ${added.length} members.`, added: added.length });
    } catch (error: any) {
      console.error('AgmManagementController.bulkAddMembers:', error);
      res.status(500).json({ error: error.message || 'Failed to bulk add members.' });
    }
  }

  // ─── RESOLUTIONS ─────────────────────────────────────────────────────
  static async getResolutions(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { meetingId } = req.params;
      const resolutions = await db.select().from(agmResolutions)
        .where(and(eq(agmResolutions.meetingId, meetingId), eq(agmResolutions.organizationId, organizationId)))
        .orderBy(agmResolutions.resolutionNo);
      res.json(resolutions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async addResolution(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const body = req.body;

      // Auto-increment resolution number
      const [last] = await db.select({ maxNo: sql<number>`coalesce(max(${agmResolutions.resolutionNo}), 0)` })
        .from(agmResolutions)
        .where(eq(agmResolutions.meetingId, body.meetingId));

      const [created] = await db.insert(agmResolutions).values({
        organizationId,
        meetingId: body.meetingId,
        resolutionNo: (last?.maxNo || 0) + 1,
        title: body.title,
        titleNepali: body.titleNepali,
        description: body.description,
        proposedBy: body.proposedBy,
        secondedBy: body.secondedBy,
        status: body.status || 'Proposed',
        votesFor: body.votesFor,
        votesAgainst: body.votesAgainst,
        abstained: body.abstained,
        decision: body.decision,
        assignedTo: body.assignedTo,
        dueDateBs: body.dueDateBs,
        attachments: body.attachments || [],
        createdBy: req.user?.username,
      }).returning();

      // Update resolution count on meeting
      const [countRow] = await db.select({ count: sql<number>`count(*)` })
        .from(agmResolutions).where(eq(agmResolutions.meetingId, body.meetingId));
      await db.update(agmMeetings).set({ resolutionsCount: countRow?.count || 0, updatedAt: new Date() })
        .where(eq(agmMeetings.id, body.meetingId));

      res.status(201).json(created);
    } catch (error: any) {
      console.error('AgmManagementController.addResolution:', error);
      res.status(500).json({ error: error.message || 'Failed to add resolution.' });
    }
  }

  static async updateResolution(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const [updated] = await db.update(agmResolutions).set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(agmResolutions.id, id), eq(agmResolutions.organizationId, organizationId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Resolution not found.' });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteResolution(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      await db.delete(agmResolutions)
        .where(and(eq(agmResolutions.id, id), eq(agmResolutions.organizationId, organizationId)));
      res.json({ message: 'Resolution deleted.', id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ─── NEWS ────────────────────────────────────────────────────────────
  static async getNews(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const news = await db.select().from(agmNews)
        .where(eq(agmNews.organizationId, organizationId))
        .orderBy(desc(agmNews.createdAt));
      res.json(news);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createNews(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const body = req.body;
      const [created] = await db.insert(agmNews).values({
        organizationId,
        title: body.title,
        titleNepali: body.titleNepali,
        content: body.content,
        contentNepali: body.contentNepali,
        category: body.category || 'Announcement',
        priority: body.priority || 'Medium',
        publishDateBs: body.publishDateBs,
        expiryDateBs: body.expiryDateBs,
        isPublished: body.isPublished || false,
        attachments: body.attachments || [],
        createdBy: req.user?.username,
      }).returning();
      res.status(201).json(created);
    } catch (error: any) {
      console.error('AgmManagementController.createNews:', error);
      res.status(500).json({ error: error.message || 'Failed to create news.' });
    }
  }

  static async updateNews(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const [updated] = await db.update(agmNews).set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(agmNews.id, id), eq(agmNews.organizationId, organizationId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'News not found.' });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteNews(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      await db.delete(agmNews)
        .where(and(eq(agmNews.id, id), eq(agmNews.organizationId, organizationId)));
      res.json({ message: 'News deleted.', id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ─── TEAM MEMBERS ──────────────────────────────────────────────────────
  static async getTeamMembers(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { category, meetingId } = req.query;
      let query = db.select().from(agmTeamMembers).where(eq(agmTeamMembers.organizationId, organizationId));
      if (category && typeof category === 'string') {
        query = db.select().from(agmTeamMembers).where(and(eq(agmTeamMembers.organizationId, organizationId), eq(agmTeamMembers.category, category)));
      }
      if (meetingId && typeof meetingId === 'string') {
        query = db.select().from(agmTeamMembers).where(and(eq(agmTeamMembers.organizationId, organizationId), eq(agmTeamMembers.meetingId, meetingId)));
      }
      const members = await query.orderBy(agmTeamMembers.orderIndex);
      res.json(members);
    } catch (error: any) {
      console.error('AgmManagementController.getTeamMembers:', error);
      res.status(500).json({ error: error.message || 'Failed to load team members.' });
    }
  }

  static async getTeamMember(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const [member] = await db.select().from(agmTeamMembers)
        .where(and(eq(agmTeamMembers.id, id), eq(agmTeamMembers.organizationId, organizationId)))
        .limit(1);
      if (!member) return res.status(404).json({ error: 'Team member not found.' });
      res.json(member);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async addTeamMember(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const body = req.body;
      const [created] = await db.insert(agmTeamMembers).values({
        organizationId,
        meetingId: body.meetingId || null,
        employeeId: body.employeeId || null,
        name: body.name,
        nameNepali: body.nameNepali,
        role: body.role,
        category: body.category || 'Board',
        designation: body.designation,
        phone: body.phone,
        email: body.email,
        address: body.address,
        photoUrl: body.photoUrl,
        documents: body.documents || [],
        orderIndex: body.orderIndex || 0,
        status: body.status || 'Active',
        joinedDateBs: body.joinedDateBs,
        tenureEndBs: body.tenureEndBs,
        notes: body.notes,
        createdBy: req.user?.username,
      }).returning();
      res.status(201).json(created);
    } catch (error: any) {
      console.error('AgmManagementController.addTeamMember:', error);
      res.status(500).json({ error: error.message || 'Failed to add team member.' });
    }
  }

  static async updateTeamMember(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const [updated] = await db.update(agmTeamMembers).set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(agmTeamMembers.id, id), eq(agmTeamMembers.organizationId, organizationId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Team member not found.' });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteTeamMember(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      await db.delete(agmTeamMembers)
        .where(and(eq(agmTeamMembers.id, id), eq(agmTeamMembers.organizationId, organizationId)));
      res.json({ message: 'Team member deleted.', id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
