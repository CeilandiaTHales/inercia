import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// The pool for the system database (only used in CONTROL_PLANE)
let basePool: Pool | null = null;

// Cache for project specific pools
const projectPools: Record<string, Pool> = {};

export const getBasePool = () => {
  if (process.env.INSTANCE_MODE === 'DATA_PLANE') {
    throw new Error("Security Violation: Data Plane tried to access System Database.");
  }
  if (!basePool) {
    basePool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return basePool;
};

export const getProjectPool = async (projectId: string): Promise<Pool> => {
    // 1. DATA_PLANE MODE: Always use the direct database URL from environment
    if (process.env.INSTANCE_MODE === 'DATA_PLANE') {
        if (!projectPools['current']) {
            projectPools['current'] = new Pool({
                connectionString: process.env.DATABASE_URL, // In data plane, this is the client's DB
                max: Number(process.env.POOL_SIZE) || 20,
                idleTimeoutMillis: 30000,
            });
        }
        return projectPools['current'];
    }

    // 2. CONTROL_PLANE MODE: Resolve dynamically for the Studio
    if (projectId === 'system') return getBasePool();
    if (projectPools[projectId]) return projectPools[projectId];

    const poolSystem = getBasePool();
    const res = await poolSystem.query('SELECT db_url FROM inercia_sys.projects WHERE id = $1', [projectId]);
    if (res.rows.length === 0) throw new Error("Project not found in system registry.");

    const dbUrl = res.rows[0].db_url;
    const pool = new Pool({
        connectionString: dbUrl,
        max: 10,
        idleTimeoutMillis: 30000,
    });

    projectPools[projectId] = pool;
    return pool;
};

export default basePool;
