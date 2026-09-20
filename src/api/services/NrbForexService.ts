/**
 * NRB Forex Service
 * Fetches official daily foreign exchange rates from Nepal Rastra Bank's public API.
 * Source: https://www.nrb.org.np/api/forex/v1/rates
 * NRB publishes once daily shortly after midnight NPT (UTC+5:45).
 */
export interface NrbRate {
  iso3: string;
  name: string;
  unit: number;
  buy: number;
  sell: number;
}

export interface NrbDailyRates {
  date: string;
  rates: NrbRate[];
}

const NRB_BASE = 'https://www.nrb.org.np/api/forex/v1/rates';

const toYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Fetch published rates for a window of dates and return the most recent
 * available day (NRB may publish today's rates a little after midnight).
 */
export async function fetchLatestRates(date: Date = new Date(), lookbackDays = 7): Promise<NrbDailyRates> {
  const from = new Date(date);
  from.setDate(from.getDate() - lookbackDays);
  const url = `${NRB_BASE}?from=${toYmd(from)}&to=${toYmd(date)}&per_page=100&page=1`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'sahakari-sathi/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`NRB API responded with ${res.status} ${res.statusText}`);
  }

  const body: any = await res.json();
  const payload: any[] = body?.data?.payload ?? [];
  if (payload.length === 0) {
    throw new Error('NRB API returned no exchange rates for the requested window.');
  }

  const latest = payload[0];
  const rates: NrbRate[] = (latest?.rates ?? []).map((r: any) => ({
    iso3: String(r?.currency?.iso3 ?? '').toUpperCase(),
    name: String(r?.currency?.name ?? ''),
    unit: Number(r?.currency?.unit ?? 1),
    buy: Number(r?.buy ?? 0),
    sell: Number(r?.sell ?? 0),
  }));

  return { date: String(latest?.date ?? toYmd(date)), rates };
}

/** Find the USD→NPR rate, computing the official middle rate. */
export async function fetchUsdNprRate(date: Date = new Date()): Promise<NrbRate & { middle: number }> {
  const daily = await fetchLatestRates(date);
  const usd = daily.rates.find((r) => r.iso3 === 'USD');
  if (!usd || usd.buy <= 0 || usd.sell <= 0) {
    throw new Error('USD rate not available from NRB for the requested date.');
  }
  return { ...usd, middle: Number(((usd.buy + usd.sell) / 2).toFixed(4)) };
}
