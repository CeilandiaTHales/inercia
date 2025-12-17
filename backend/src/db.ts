import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let basePool: Pool | null = null;
const projectPools: Record<string, Pool> = {};

export const getBasePool = () => {
  if (process.env.INSTANCE_MODE === 'DATA_PLANE') {
    throw new Error("Security Violation: Data Plane cannot access System DB.");
  }
  if (!basePool) {
    basePool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    basePool.on('error', (err) => console.error('[DB] Base Pool Error:', err));
  }
  return basePool;
};

export const getProjectPool = async (projectId: string): Promise<Pool> => {
    // 1. Data Plane logic
    if (process.env.INSTANCE_MODE === 'DATA_PLANE') {
        if (!projectPools['current']) {
            projectPools['current'] = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
        }
        return projectPools['current'];
    }

    // 2. Control Plane (Studio) logic
    if (projectId === 'system') return getBasePool();
    if (projectPools[projectId]) return projectPools[projectId];

    const poolSystem = getBasePool();
    const res = await poolSystem.query('SELECT db_url FROM inercia_sys.projects WHERE id = $1', [projectId]);
    if (res.rows.length === 0) throw new Error("Project not found.");

    let dbUrl = res.rows[0].db_url;
    
    // Fallback especial para o projeto inicial não precisar de senha hardcoded no SQL
    if (dbUrl === 'SYSTEM_INTERNAL') {
        return poolSystem;
    }

    const pool = new Pool({
        connectionString: dbUrl,
        max: 10,
        idleTimeoutMillis: 30000,
    });

    projectPools[projectId] = pool;
    return pool;
};
