import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log(`Initializing DB connection pool...`);
console.log(`Timezone: ${process.env.TZ || 'UTC'}`);

const poolSize = parseInt(process.env.POOLER_DEFAULT_POOL_SIZE || '20', 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolSize, // Optimized for server capacity
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased for stability
});

pool.on('connect', (client) => {
  // Ensure the connection uses the correct timezone
  if (process.env.TZ) {
      client.query(`SET timezone TO '${process.env.TZ}'`).catch(console.error);
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Do not exit process immediately in production, try to recover or let container orchestrator restart
});

export default pool;