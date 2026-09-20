import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    // 1. Get a real org ID
    const orgs = await sql`SELECT id FROM organizations LIMIT 3`;
    console.log('Orgs:', JSON.stringify(orgs));
    
    if (orgs.length === 0) {
      console.log('No orgs found!');
      await sql.end();
      return;
    }
    
    const orgId = orgs[0].id;
    console.log('Using org:', orgId);

    // 2. Try the exact INSERT the service does
    const r = await sql`INSERT INTO document_templates 
      (organization_id, category, name, layout_json, status, version)
      VALUES (${orgId}, 'receipt', 'Test Insert', '{"elements":[]}'::jsonb, 'draft', 1)
      RETURNING id, name`;
    console.log('INSERT OK:', JSON.stringify(r));

    // 3. Cleanup
    await sql`DELETE FROM document_templates WHERE name = 'Test Insert'`;
    console.log('DELETE OK');
  } catch(e: any) {
    console.error('FULL ERROR:', e.message);
    console.error('CODE:', e.code);
    console.error('DETAIL:', e.detail);
    console.error('HINT:', e.hint);
  }
  await sql.end();
}
main();
