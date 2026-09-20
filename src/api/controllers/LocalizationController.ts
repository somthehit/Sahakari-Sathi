import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { organizationLocalizationSettings } from '../../db/schema';
import { buildAuditRow, writeAuditLog, computeDiff, splitDiffIntoSnapshots } from '../utils/audit';

export { updateLocalizationSettingsSchema } from '../schemas/organizationSettings';

interface OrgUser {
  organizationId?: string;
  userId?: string;
  username?: string;
  role?: string;
}

const DEFAULT_LOCALIZATION_SETTINGS = {
  organizationId: '',
  defaultLanguage: 'ne',
  supportedLanguages: ['ne', 'en'],
  primaryCalendarSystem: 'BS',
  dateDisplayFormat: 'YYYY-MM-DD',
  numberFormatStyle: 'IN',
  currencySymbol: 'रु.',
  currencySymbolPosition: 'prefix',
  enableAutoTransliteration: false,
};

export class LocalizationController {
  static async getSettings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const [row] = await db.select().from(organizationLocalizationSettings)
        .where(eq(organizationLocalizationSettings.organizationId, organizationId))
        .limit(1);

      res.json(row ?? { ...DEFAULT_LOCALIZATION_SETTINGS, organizationId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateSettings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const body = req.body;
      const before = (await db.select().from(organizationLocalizationSettings)
        .where(eq(organizationLocalizationSettings.organizationId, organizationId))
        .limit(1))[0] ?? null;

      const updateValues = {
        organizationId,
        updatedAt: new Date(),
        ...(body.defaultLanguage !== undefined ? { defaultLanguage: body.defaultLanguage } : {}),
        ...(body.supportedLanguages !== undefined ? { supportedLanguages: body.supportedLanguages } : {}),
        ...(body.primaryCalendarSystem !== undefined ? { primaryCalendarSystem: body.primaryCalendarSystem } : {}),
        ...(body.dateDisplayFormat !== undefined ? { dateDisplayFormat: body.dateDisplayFormat } : {}),
        ...(body.numberFormatStyle !== undefined ? { numberFormatStyle: body.numberFormatStyle } : {}),
        ...(body.currencySymbol !== undefined ? { currencySymbol: body.currencySymbol } : {}),
        ...(body.currencySymbolPosition !== undefined ? { currencySymbolPosition: body.currencySymbolPosition } : {}),
        ...(body.enableAutoTransliteration !== undefined ? { enableAutoTransliteration: body.enableAutoTransliteration } : {}),
      };

      const [row] = await db.insert(organizationLocalizationSettings)
        .values(updateValues)
        .onConflictDoUpdate({
          target: organizationLocalizationSettings.organizationId,
          set: updateValues,
        })
        .returning();

      const changed = computeDiff(
        before ? { ...before } as Record<string, any> : {},
        { ...row } as Record<string, any>,
      );
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
        'Update Localization Settings',
        JSON.stringify(changed),
        splitDiffIntoSnapshots(changed),
      ));

      res.json(row);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
