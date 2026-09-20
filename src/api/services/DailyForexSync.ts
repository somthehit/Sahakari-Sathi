/**
 * Daily Forex Auto-Sync Job
 * Fetches the official NRB USD→NPR rate once per day and snapshots it into
 * exchange_rates for every organization. Best-effort: failures are logged and
 * the next tick retries. Complements the on-demand /exchange-rates/sync API.
 */
import { getDb } from '../../db/client';
import { organizations, exchangeRates } from '../../db/schema';
import { fetchUsdNprRate } from './NrbForexService';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startDailyForexSync(initialDelayMs = 60_000, intervalMs = DAY_MS): NodeJS.Timeout {
  const run = async () => {
    try {
      const db = getDb();
      if (!db) {
        console.warn('[ForexSync] DB not connected — skipping.');
        return;
      }
      const orgs = await db.select({ id: organizations.id }).from(organizations);
      if (orgs.length === 0) {
        console.warn('[ForexSync] No organizations found — skipping.');
        return;
      }

      const usd = await fetchUsdNprRate();
      const effectiveDate = new Date().toISOString().slice(0, 10);

      for (const org of orgs) {
        await db.insert(exchangeRates)
          .values({
            organizationId: org.id,
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
          });
      }

      console.log(`[ForexSync] Synced NRB USD→NPR rate for ${orgs.length} org(s) on ${effectiveDate} (middle ${usd.middle}).`);
    } catch (error: any) {
      console.error('[ForexSync] Failed to sync exchange rate:', error?.message ?? error);
    }
  };

  const timer = setTimeout(() => {
    void run();
    setInterval(() => void run(), intervalMs);
  }, initialDelayMs);

  timer.unref?.();
  return timer;
}
