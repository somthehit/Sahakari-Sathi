import { Request, Response } from 'express';
import { eq, desc, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  exchangeRates,
  organizationFinancialSettings,
  memberTransactions,
  shareTransactions,
  vouchers,
  savingsTransactions,
  loanRepayments,
} from '../../db/schema';
import { fetchUsdNprRate } from '../services/NrbForexService';
import {
  createExchangeRateSchema,
  updateFinancialSettingsSchema,
} from '../schemas/organizationSettings';
import { buildAuditRow, writeAuditLog, computeDiff, splitDiffIntoSnapshots } from '../utils/audit';

export { createExchangeRateSchema, updateFinancialSettingsSchema };

interface OrgUser {
  organizationId?: string;
  userId?: string;
  username?: string;
  role?: string;
}

const DEFAULT_SETTINGS = {
  defaultCurrency: 'NPR',
  allowedCurrencies: ['NPR', 'USD'],
  defaultForexMarkupPercent: '0.00',
  isTaxEnabled: false,
  taxName: 'GST',
  defaultTaxRatePercent: '0.00',
  taxNumber: null,
};

export class ExchangeRateController {
  /**
   * True once the org has any financial transaction (member tx, share tx,
   * voucher, savings tx, loan repayment). From that point the base currency
   * becomes immutable to protect the accounting trail.
   */
  static async hasFinancialActivity(db: NonNullable<ReturnType<typeof getDb>>, organizationId: string): Promise<boolean> {
    const [locked] = await db.select({ n: sql<number>`1` })
      .from(sql`(
        (SELECT 1 AS n FROM ${memberTransactions} WHERE ${memberTransactions.organizationId} = ${organizationId} LIMIT 1)
        UNION ALL
        (SELECT 1 AS n FROM ${shareTransactions} WHERE ${shareTransactions.organizationId} = ${organizationId} LIMIT 1)
        UNION ALL
        (SELECT 1 AS n FROM ${vouchers} WHERE ${vouchers.organizationId} = ${organizationId} LIMIT 1)
        UNION ALL
        (SELECT 1 AS n FROM ${savingsTransactions} WHERE ${savingsTransactions.organizationId} = ${organizationId} LIMIT 1)
        UNION ALL
        (SELECT 1 AS n FROM ${loanRepayments} WHERE ${loanRepayments.organizationId} = ${organizationId} LIMIT 1)
      ) AS t`);
    return !!locked;
  }

  static async getRates(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const rows = await db.select().from(exchangeRates)
        .where(eq(exchangeRates.organizationId, organizationId))
        .orderBy(desc(exchangeRates.effectiveDate))
        .limit(60);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getFinancialSettings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const [row] = await db.select().from(organizationFinancialSettings)
        .where(eq(organizationFinancialSettings.organizationId, organizationId))
        .limit(1);
      const baseCurrencyLocked = await ExchangeRateController.hasFinancialActivity(db, organizationId);
      res.json({
        ...(row ?? { organizationId, ...DEFAULT_SETTINGS }),
        baseCurrencyLocked,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateFinancialSettings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const body = req.body;

      // Base-currency lock: once any financial transaction exists for this org,
      // the defaultCurrency may not be changed. Changing it would corrupt the
      // accounting trail. (Module 1: Currency & Forex integration.)
      const changingCurrency = body.defaultCurrency !== undefined;
      if (changingCurrency) {
        const [settings] = await db.select().from(organizationFinancialSettings)
          .where(eq(organizationFinancialSettings.organizationId, organizationId))
          .limit(1);
        if (settings && settings.defaultCurrency !== body.defaultCurrency
            && await ExchangeRateController.hasFinancialActivity(db, organizationId)) {
          return res.status(409).json({
            error: `Base currency cannot be changed. The organization already has financial transactions recorded in ${settings.defaultCurrency}.`,
          });
        }
      }

      const before = (await db.select().from(organizationFinancialSettings)
        .where(eq(organizationFinancialSettings.organizationId, organizationId))
        .limit(1))[0] ?? { organizationId, ...DEFAULT_SETTINGS };

      const insertValues = {
        organizationId,
        updatedAt: new Date(),
        ...(body.defaultCurrency !== undefined ? { defaultCurrency: body.defaultCurrency } : {}),
        ...(body.allowedCurrencies !== undefined ? { allowedCurrencies: body.allowedCurrencies } : {}),
        ...(body.defaultForexMarkupPercent !== undefined ? { defaultForexMarkupPercent: String(body.defaultForexMarkupPercent) } : {}),
        ...(body.isTaxEnabled !== undefined ? { isTaxEnabled: body.isTaxEnabled } : {}),
        ...(body.taxName !== undefined ? { taxName: body.taxName } : {}),
        ...(body.defaultTaxRatePercent !== undefined ? { defaultTaxRatePercent: String(body.defaultTaxRatePercent) } : {}),
        ...(body.taxNumber !== undefined ? { taxNumber: body.taxNumber ?? null } : {}),
      };

      const [row] = await db.insert(organizationFinancialSettings)
        .values(insertValues)
        .onConflictDoUpdate({
          target: organizationFinancialSettings.organizationId,
          set: insertValues,
        })
        .returning();

      const changed = computeDiff(before as Record<string, any>, row as Record<string, any>);
      if (Object.keys(changed).length > 0) {
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
          'Update Financial Settings',
          JSON.stringify(changed),
          splitDiffIntoSnapshots(changed),
        ));
      }

      res.json(row);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createRate(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const body = req.body;
      const effectiveDate = body.effectiveDate ?? new Date().toISOString().slice(0, 10);

      const [row] = await db.insert(exchangeRates)
        .values({
          organizationId,
          baseCurrency: body.baseCurrency ?? 'USD',
          targetCurrency: body.targetCurrency ?? 'NPR',
          buyRate: String(body.buyRate),
          sellRate: String(body.sellRate),
          officialMiddleRate: String(body.officialMiddleRate),
          effectiveDate,
        })
        .onConflictDoUpdate({
          target: [exchangeRates.organizationId, exchangeRates.baseCurrency, exchangeRates.targetCurrency, exchangeRates.effectiveDate],
          set: {
            buyRate: String(body.buyRate),
            sellRate: String(body.sellRate),
            officialMiddleRate: String(body.officialMiddleRate),
          },
        })
        .returning();

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
        'Create Exchange Rate',
        `Upserted ${row.baseCurrency}→${row.targetCurrency} @ ${row.effectiveDate} (buy ${row.buyRate} / sell ${row.sellRate})`,
      ));

      res.status(201).json(row);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Fetch today's official USD→NPR rate from NRB and snapshot it into exchange_rates. */
  static async syncLatest(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const usd = await fetchUsdNprRate();
      const effectiveDate = new Date().toISOString().slice(0, 10);

      const [rate] = await db.insert(exchangeRates)
        .values({
          organizationId,
          baseCurrency: 'USD',
          targetCurrency: 'NPR',
          buyRate: String(usd.buy),
          sellRate: String(usd.sell),
          officialMiddleRate: String(usd.middle),
          effectiveDate,
        })
        .onConflictDoUpdate({
          target: [exchangeRates.organizationId, exchangeRates.baseCurrency, exchangeRates.targetCurrency, exchangeRates.effectiveDate],
          set: {
            buyRate: String(usd.buy),
            sellRate: String(usd.sell),
            officialMiddleRate: String(usd.middle),
          },
        })
        .returning();

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
        'Sync Exchange Rate',
        `NRB sync ${rate.baseCurrency}→${rate.targetCurrency} @ ${effectiveDate} (buy ${usd.buy} / sell ${usd.sell})`,
      ));

      const [settings] = await db.select().from(organizationFinancialSettings)
        .where(eq(organizationFinancialSettings.organizationId, organizationId))
        .limit(1);

      res.json({
        rate,
        settings: {
          ...(settings ?? { organizationId, ...DEFAULT_SETTINGS }),
          baseCurrencyLocked: await ExchangeRateController.hasFinancialActivity(db, organizationId),
        },
        source: 'NRB',
      });
    } catch (error: any) {
      res.status(502).json({ error: error.message });
    }
  }
}
