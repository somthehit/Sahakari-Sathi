import 'dotenv/config';
import { getDb } from './src/db/client';

const db = getDb();
if (!db) {
  console.log('NO_DB');
  process.exit(1);
}

const q = async (label: string, sql: string) => {
  try {
    const r = await db.execute(sql);
    const rows = (r as any)?.rows ?? r;
    console.log(label, JSON.stringify(rows));
  } catch (e: any) {
    console.log(label, 'ERR', e.cause?.message ?? e.message);
  }
};

await q('FAMILY_COLS', `select column_name from information_schema.columns where table_name='member_family' order by ordinal_position`);
await q('KYC_COLS', `select column_name from information_schema.columns where table_name='member_kyc_profiles' order by ordinal_position`);
await q('FAMILY_COUNT', `select count(*) as c from member_family`);
await q('KYC_COUNT', `select count(*) as c from member_kyc_profiles`);
await q('REL_TYPES', `select id, organization_id, code, name from relationship_types`);
