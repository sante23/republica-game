require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function applyMigration() {
  const migrationFile = path.join(__dirname, 'migrations', '006_phase3_features.sql');
  const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

  try {
    console.log('Applying Phase 3 migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigration().catch(console.error);
