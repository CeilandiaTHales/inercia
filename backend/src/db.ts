import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log(`Initializing DB connection pool...`);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  // Optional: console.log('New client connected to database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1); // Critical failure if DB connection is lost
});

export default pool;
