import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let basePool: Pool | null = null;
const projectPools: Record<string, Pool> = {};

export const getBasePool = () => {
  if (process.env.INSTANCE_MODE === 'DATA_PLANE') {
    throw new Error("Security Violation: Data Plane tried to access System Database.");
  }
  if (!basePool) {
    console.log("[DB] Initializing Base Pool Connection...");
    basePool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    
    basePool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client', err);
    });
  }
  return basePool;
};

export const getProjectPool = async (projectId: string): Promise<Pool> => {
    if (process.env.INSTANCE_MODE === 'DATA_PLANE') {
        if (!projectPools['current']) {
            console.log("[DB] Initializing Data Plane Project Pool...");
            projectPools['current'] = new Pool({
                connectionString: process.env.DATABASE_URL,
                max: Number(process.env.POOL_SIZE) || 20,
                idleTimeoutMillis: 30000,
            });
        }
        return projectPools['current'];
    }

    if (projectId === 'system') return getBasePool();
    if (projectPools[projectId]) return projectPools[projectId];

    const poolSystem = getBasePool();
    const res = await poolSystem.query('SELECT db_url FROM inercia_sys.projects WHERE id = $1', [projectId]);
    if (res.rows.length === 0) throw new Error("Project not found in registry.");

    const dbUrl = res.rows[0].db_url;
    console.log(`[DB] Creating Dynamic Pool for Project: ${projectId}`);
    
    const pool = new Pool({
        connectionString: dbUrl,
        max: 10,
        idleTimeoutMillis: 30000,
    });

    projectPools[projectId] = pool;
    return pool;
};

export default basePool;