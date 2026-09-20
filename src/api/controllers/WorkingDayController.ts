import { Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { workingDays } from '../../db/schema';
import { buildAuditRow, writeAuditLog } from '../utils/audit';

export { updateWorkingDaysSchema } from '../schemas/organizationSettings';

interface OrgUser {
  organizationId?: string;
  userId?: string;
  username?: string;
  role?: string;
}

// 0 = Sunday … 6 = Saturday (Nepal week convention).
const DEFAULT_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_OPEN = '10:00';
const DEFAULT_CLOSE = '17:00';
const WEEKEND_DAYS = [6]; // Saturday

const toTime = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
};

const normalize = (row: typeof workingDays.$inferSelect) => ({
  dayOfWeek: row.dayOfWeek,
  isWorkingDay: row.isWorkingDay,
  openTime: row.openTime ? String(row.openTime).slice(0, 5) : null,
  closeTime: row.closeTime ? String(row.closeTime).slice(0, 5) : null,
  halfDay: row.halfDay,
});

export class WorkingDayController {
  /** Return the org's working-day schedule, seeding defaults on first access. */
  static async getWorkingDays(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      let rows = await db.select().from(workingDays).where(eq(workingDays.organizationId, organizationId));
      if (rows.length === 0) {
        const seeds = DEFAULT_DAYS.map((day) => ({
          organizationId,
          dayOfWeek: day,
          isWorkingDay: !WEEKEND_DAYS.includes(day),
          openTime: WEEKEND_DAYS.includes(day) ? null : DEFAULT_OPEN,
          closeTime: WEEKEND_DAYS.includes(day) ? null : DEFAULT_CLOSE,
          halfDay: false,
        }));
        await db.insert(workingDays).values(seeds);
        rows = await db.select().from(workingDays).where(eq(workingDays.organizationId, organizationId));
      }

      res.json(rows.map(normalize).sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Bulk upsert the org's working-day schedule (all 7 days in one request). */
  static async updateWorkingDays(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const { days } = req.body;

      await db.insert(workingDays)
        .values(days.map((d: any) => ({
          organizationId,
          dayOfWeek: d.dayOfWeek,
          isWorkingDay: d.isWorkingDay ?? true,
          openTime: toTime(d.openTime),
          closeTime: toTime(d.closeTime),
          halfDay: d.halfDay ?? false,
        })))
        .onConflictDoUpdate({
          target: [workingDays.organizationId, workingDays.dayOfWeek],
          set: {
            isWorkingDay: sql`excluded.is_working_day`,
            openTime: sql`excluded.open_time`,
            closeTime: sql`excluded.close_time`,
            halfDay: sql`excluded.half_day`,
            updatedAt: new Date(),
          },
        });

      const rows = await db.select().from(workingDays).where(eq(workingDays.organizationId, organizationId));
      const result = rows.map(normalize).sort((a, b) => a.dayOfWeek - b.dayOfWeek);

      const workDays = result.filter((d) => d.isWorkingDay).map((d) => `day ${d.dayOfWeek} (${d.openTime}–${d.closeTime})${d.halfDay ? ' half-day' : ''}`);
      await writeAuditLog(buildAuditRow(
        {
          organizationId,
          userId: req.user?.userId,
          username: req.user?.username,
          role: req.user?.role,
          ipAddress: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
        },
        'Organization Setup',
        'Update Working Days',
        workDays.length
          ? `${result.length} days configured, ${workDays.length} working: ${workDays.join(', ')}`
          : `${result.length} days configured, all closed`,
      ));

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
