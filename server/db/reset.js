import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function resetDatabase() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    const dbName = process.env.POSTGRES_DB || 'kmg_events_db';

    // Terminate all connections to the database
    await client.query(
      `SELECT pg_terminate_backend(pg_stat_activity.pid)
       FROM pg_stat_activity
       WHERE pg_stat_activity.datname = $1
       AND pid <> pg_backend_pid()`,
      [dbName]
    );

    // Drop the database
    await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
    console.log(`✓ Database '${dbName}' dropped`);

    await client.end();

    // Re-run migration and seed
    console.log('\nRe-running migration...');
    const { execSync } = await import('child_process');
    execSync('node db/migrate.js', { stdio: 'inherit' });
    
    console.log('\nRe-running seed...');
    execSync('node db/seed.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();
