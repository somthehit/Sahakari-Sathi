import 'dotenv/config';
import { getDb } from './src/db/client';
(async () => {
  const db = getDb();
  if (!db) { console.log('NO DB'); process.exit(0); }
  const org: any = await db.execute(`SELECT id, organization_code, organization_name, short_name, address, district, municipality, province FROM organizations`);
  console.log('ORGS:', JSON.stringify(org));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
