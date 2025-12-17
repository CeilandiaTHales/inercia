import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const basePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// Cache for project specific pools
const projectPools: Record<string, Pool> = {};

export const getBasePool = () => basePool;

export const getProjectPool = async (projectId: string): Promise<Pool> => {
    // If it's the default "system" project or similar
    if (projectId === 'system') return basePool;

    if (projectPools[projectId]) return projectPools[projectId];

    // Fetch project DB connection from base database
    const res = await basePool.query('SELECT db_url FROM inercia_sys.projects WHERE id = $1', [projectId]);
    if (res.rows.length === 0) throw new Error("Project not found");

    const dbUrl = res.rows[0].db_url;
    const pool = new Pool({
        connectionString: dbUrl,
        max: 20,
        idleTimeoutMillis: 30000,
    });

    projectPools[projectId] = pool;
    return pool;
};

export default basePool;