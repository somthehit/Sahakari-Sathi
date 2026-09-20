import 'dotenv/config';
import { getDb } from '../src/db/client';
import { documentTemplates } from '../src/db/schema/documentTemplates';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Getting DB...');
  const db = getDb();
  if (!db) { console.error('DB not connected'); process.exit(1); }
  console.log('DB connected, running simple query...');

  try {
    // Try a simple select first
    console.log('SELECT...');
    const r = await db.select().from(documentTemplates).limit(1);
    console.log('SELECT result:', JSON.stringify(r));
  } catch (err: any) {
    console.error('ERROR:', err.message);
    console.error('STACK:', err.stack);
  }

  process.exit(0);
}
main();
