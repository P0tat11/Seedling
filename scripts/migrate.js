const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('@neondatabase/serverless');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing. Run npm run env:pull first.');
  }

  const schema = await fs.readFile(path.join(__dirname, '../db/schema.sql'), 'utf8');
  const statements = schema
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const statement of statements) {
      await client.query(statement);
    }
    await client.query('COMMIT');
    console.log(`Applied ${statements.length} database schema statements.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
});
