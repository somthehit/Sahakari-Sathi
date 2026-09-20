import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const r = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'document_templates' ORDER BY ordinal_position`;
    console.log('document_templates columns:', JSON.stringify(r, null, 2));
    const v = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'document_template_versions' ORDER BY ordinal_position`;
    console.log('document_template_versions columns:', JSON.stringify(v, null, 2));
  } catch(e: any) { console.error('Error:', e.message); }
  await sql.end();
}
main();
