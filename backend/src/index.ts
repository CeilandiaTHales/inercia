import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getBasePool, getProjectPool } from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

// --- SYSTEM INITIALIZATION (BASE DB) ---
const setupSystem = async () => {
    const pool = getBasePool();
    try {
        console.log("Initializing Inércia Multi-Project System...");
        await pool.query(`CREATE SCHEMA IF NOT EXISTS inercia_sys`);
        await pool.query(`CREATE SCHEMA IF NOT EXISTS auth`); // System Admins
        
        // Projects Table (The heart of the BaaS)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inercia_sys.projects (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(100) UNIQUE NOT NULL,
                db_url TEXT NOT NULL,
                api_url TEXT,
                cors_origins TEXT[],
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // System Admin Users
        await pool.query(`
            CREATE TABLE IF NOT EXISTS auth.users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) UNIQUE NOT NULL,
                encrypted_password TEXT,
                role VARCHAR(50) DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Seed Default Project if none exists
        const projCount = await pool.query('SELECT count(*) FROM inercia_sys.projects');
        if (parseInt(projCount.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO inercia_sys.projects (name, slug, db_url) 
                VALUES ('Meu Primeiro Projeto', 'default', $1)`, 
                [process.env.DATABASE_URL]
            );
        }

        const superEmail = process.env.SUPER_ADMIN_EMAIL;
        const superPass = process.env.SUPER_ADMIN_PASSWORD;
        if (superEmail && superPass) {
            const hash = await bcrypt.hash(superPass, 10);
            await pool.query(`INSERT INTO auth.users (email, encrypted_password, role) VALUES ($1, $2, 'admin') ON CONFLICT (email) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password`, [superEmail, hash]);
        }
        console.log("System Ready.");
    } catch (e) { console.error("System init error", e); }
};

setupSystem();

// --- MIDDLEWARE TO DETECT CONTEXT ---
const getContext = async (req: any, res: any, next: any) => {
    const projectId = req.headers['x-project-id'];
    if (!projectId && !req.path.startsWith('/api/auth') && !req.path.startsWith('/api/projects')) {
        // Only allow missing project ID for global admin routes
        return res.status(400).json({ error: "x-project-id header required for data operations" });
    }
    
    try {
        if (projectId) {
            req.projectPool = await getProjectPool(projectId);
            req.projectId = projectId;
        }
        next();
    } catch (e: any) { res.status(404).json({ error: e.message }); }
};

// Scoped Executor (Maintains RLS but uses the current project's pool)
async function executeScoped(pool: any, user: any, query: string, params: any[] = []) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const role = user?.role || 'anon';
        await client.query(`SELECT set_config('inercia.user_id', $1, true)`, [user?.id || '']);
        await client.query(`SELECT set_config('inercia.user_role', $1, true)`, [role]);
        
        if (role === 'admin' || role === 'service_role') await client.query('SET ROLE postgres');
        else await client.query(`SET ROLE "${role}"`);
        
        const res = await client.query(query, params);
        await client.query('COMMIT');
        return res;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        await client.query('RESET ROLE');
        client.release();
    }
}

app.use(helmet() as any); 
app.use(cors());
app.use(express.json({ limit: '50mb' }) as any);
app.use(getContext);

const authenticateJWT = (req: any, res: any, next: any) => {
    const apiKey = req.headers['apikey'];
    if (apiKey && apiKey === process.env.JWT_SECRET) {
        req.user = { id: 'service_role', role: 'service_role' };
        return next();
    }
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
            if (err) return res.status(403).json({ error: "Session expired" });
            req.user = user;
            next();
        });
    } else res.status(401).json({ error: "Auth required" });
};

// --- ROUTES ---

// Projects Management (Global)
app.get('/api/projects', authenticateJWT, async (req, res) => {
    const r = await getBasePool().query('SELECT * FROM inercia_sys.projects ORDER BY created_at DESC');
    res.json(r.rows);
});

// REST API (Multi-Project Scoped)
app.get('/api/rest/v1/:table', authenticateJWT, async (req: any, res) => {
    const { table } = req.params;
    try {
        const result = await executeScoped(req.projectPool, req.user, `SELECT * FROM "public"."${table}"`);
        res.json(result.rows);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// Tables Explorer (Scoped)
app.get('/api/tables', authenticateJWT, async (req: any, res) => {
    const result = await req.projectPool.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'inercia_sys') ORDER BY table_schema, table_name`);
    res.json(result.rows);
});

// Other endpoints (SQL, RPC, Policies) now use req.projectPool instead of a global pool...
app.post('/api/sql', authenticateJWT, async (req: any, res) => {
    try {
        const result = await req.projectPool.query(req.body.query);
        res.json({ rows: result.rows, command: result.command });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const result = await getBasePool().query(`SELECT * FROM auth.users WHERE email = $1`, [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Admin User not found" });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.encrypted_password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });
    const token = jwt.sign({ id: user.id, email: user.email, role: 'admin' }, process.env.JWT_SECRET as string, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, role: 'admin' } });
});

app.listen(PORT, () => { console.log(`Inércia BaaS Multi-Project running on port ${PORT}`); });
