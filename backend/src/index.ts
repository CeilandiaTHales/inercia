import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pool from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

// --- AGGRESSIVE SYSTEM SETUP ---
const setupSystem = async () => {
    try {
        console.log("Initializing Inércia System Infrastructure...");
        await pool.query(`CREATE SCHEMA IF NOT EXISTS inercia_sys`);
        await pool.query(`CREATE SCHEMA IF NOT EXISTS auth`);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inercia_sys.files (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                content TEXT,
                schema_name VARCHAR(255) DEFAULT 'principal',
                type VARCHAR(50) DEFAULT 'txt',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS auth.providers (
                id VARCHAR(50) PRIMARY KEY,
                client_id TEXT,
                client_secret TEXT,
                enabled BOOLEAN DEFAULT false,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Roles and Auth Helpers
        await pool.query(`
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
                CREATE ROLE anon NOLOGIN;
                GRANT USAGE ON SCHEMA public TO anon;
              END IF;

              IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
                CREATE ROLE authenticated NOLOGIN;
                GRANT USAGE ON SCHEMA public TO authenticated;
              END IF;
              
              IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
                CREATE ROLE service_role NOLOGIN; 
                GRANT ALL ON SCHEMA public TO service_role;
              END IF;
            END
            $$;
        `);

        await pool.query(`
            CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
            SELECT NULLIF(current_setting('inercia.user_id', true), '')::uuid;
            $$ LANGUAGE sql STABLE;

            CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
            SELECT COALESCE(current_setting('inercia.user_role', true), 'anon');
            $$ LANGUAGE sql STABLE;
        `);

        const superEmail = process.env.SUPER_ADMIN_EMAIL;
        const superPass = process.env.SUPER_ADMIN_PASSWORD;
        if (superEmail && superPass) {
            const hash = await bcrypt.hash(superPass, 10);
            await pool.query(
                `INSERT INTO auth.users (email, encrypted_password, role, provider) VALUES ($1, $2, 'admin', 'email') ON CONFLICT (email) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, role = 'admin'`,
                [superEmail, hash]
            );
        }
        
        await refreshAuthStrategies();
        console.log("System Setup Complete.");
    } catch (e) { console.error("System init error", e); }
};

const refreshAuthStrategies = async () => {
    try {
        const res = await pool.query("SELECT * FROM auth.providers WHERE enabled = true");
        passport.unuse('google');
        res.rows.forEach(p => {
            if (p.id === 'google' && p.client_id && p.client_secret) {
                passport.use(new GoogleStrategy({
                    clientID: p.client_id,
                    clientSecret: p.client_secret,
                    callbackURL: process.env.CALLBACK_URL || '/api/auth/google/callback',
                    passReqToCallback: true
                }, async (req: any, accessToken, refreshToken, profile, done) => {
                    try {
                        const email = profile.emails?.[0].value;
                        const userRes = await pool.query('SELECT * FROM auth.users WHERE email = $1', [email]);
                        let user = userRes.rows[0];
                        if (!user) {
                            const insert = await pool.query(`INSERT INTO auth.users (email, provider, role) VALUES ($1, 'google', 'user') RETURNING *`, [email]);
                            user = insert.rows[0];
                        }
                        return done(null, user);
                    } catch (err) { return done(err); }
                }));
            }
        });
    } catch (e) { console.error(e); }
};

setupSystem();

// --- SCOPED QUERY HELPER (THE RLS PROTECTOR) ---
async function executeScoped(user: any, query: string, params: any[] = []) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const role = user?.role || 'anon';
        // Set variables for RLS helpers (auth.uid, etc)
        await client.query(`SELECT set_config('inercia.user_id', $1, true)`, [user?.id || '']);
        await client.query(`SELECT set_config('inercia.user_role', $1, true)`, [role]);
        // Set actual postgres role for native TO role security
        if (role === 'admin' || role === 'service_role') {
            await client.query('SET ROLE postgres'); // Admin bypass
        } else {
            await client.query(`SET ROLE "${role}"`);
        }
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

// --- MIDDLEWARE ---
app.use(helmet() as any); 
app.use(cors());
app.use(express.json({ limit: '50mb' }) as any);
app.use(passport.initialize());

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
  } else {
    res.status(401).json({ error: "Auth required" });
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'service_role')) next();
  else res.status(403).json({ error: "Admin required" });
};

// --- ROUTES ---

// REST V1 with RLS
app.get('/api/rest/v1/:table', authenticateJWT, async (req: any, res) => {
    const { table } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    try {
        const query = `SELECT * FROM "public"."${table}" LIMIT $1 OFFSET $2`;
        const result = await executeScoped(req.user, query, [limit, offset]);
        res.json(result.rows);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// RPC with RLS
app.post('/api/rpc/:functionName', authenticateJWT, async (req: any, res) => { 
    try { 
        let { functionName } = req.params;
        let schema = 'public';
        if (functionName.includes('.')) {
            const parts = functionName.split('.');
            schema = parts[0];
            functionName = parts[1];
        }
        const values = Object.values(req.body || {}); 
        const placeholders = values.map((_, i) => `$${i + 1}`).join(','); 
        const result = await executeScoped(req.user, `SELECT * FROM "${schema}"."${functionName}"(${placeholders})`, values); 
        res.json(result.rows); 
    } catch (e: any) { res.status(400).json({ error: e.message }); } 
});

// Admin Studio Endpoints (Bypass RLS for management)
app.get('/api/config', (req, res) => { res.json({ apiExternalUrl: process.env.API_EXTERNAL_URL || 'http://localhost:3000', organization: process.env.STUDIO_DEFAULT_ORGANIZATION, project: process.env.STUDIO_DEFAULT_PROJECT }); });
app.get('/api/stats', authenticateJWT, requireAdmin, async (req, res) => {
    const dbStats = await pool.query(`SELECT (SELECT count(*) FROM auth.users) as user_count, (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count, (SELECT sum(numbackends) FROM pg_stat_database) as active_connections, (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries`);
    res.json(dbStats.rows[0]);
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query(`SELECT * FROM auth.users WHERE email = $1`, [email]);
  if (result.rows.length === 0) return res.status(401).json({ error: "User not found" });
  let user = result.rows[0];
  if (user.role !== 'admin' && user.email !== process.env.SUPER_ADMIN_EMAIL) return res.status(403).json({ error: "Dashboard is for Admins only." });
  const valid = await bcrypt.compare(password, user.encrypted_password);
  if (!valid) return res.status(401).json({ error: "Invalid password" });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

app.get('/api/auth/keys', authenticateJWT, requireAdmin, (req, res) => {
    const anonKey = jwt.sign({ role: 'anon' }, process.env.JWT_SECRET as string, { expiresIn: '10y' });
    const serviceKey = jwt.sign({ role: 'service_role' }, process.env.JWT_SECRET as string, { expiresIn: '10y' });
    res.json({ anon: anonKey, service: serviceKey });
});

app.get('/api/admin/connection-info', authenticateJWT, requireAdmin, (req, res) => {
    res.json({
        apiUrl: process.env.API_EXTERNAL_URL || 'http://localhost:3000',
        database: { url: process.env.DATABASE_URL },
        redis: { url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD }
    });
});

app.get('/api/tables', authenticateJWT, async (req, res) => {
  const result = await pool.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'inercia_sys') ORDER BY table_schema, table_name`);
  res.json(result.rows);
});

app.get('/api/rpc', authenticateJWT, async (req, res) => {
    const r = await pool.query(`SELECT n.nspname as schema, p.proname as name, pg_get_function_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.proname NOT LIKE 'pg_%' ORDER BY n.nspname, p.proname;`);
    res.json(r.rows);
});

app.get('/api/policies', authenticateJWT, async (req, res) => {
    const r = await pool.query('SELECT * FROM pg_policies');
    res.json(r.rows);
});

app.post('/api/policies', authenticateJWT, requireAdmin, async (req, res) => {
    const { table, role, command, expression, schema = 'public' } = req.body;
    try {
        const policyName = `policy_${table}_${command}_${Date.now()}`;
        await pool.query(`ALTER TABLE "${schema}"."${table}" ENABLE ROW LEVEL SECURITY`);
        let sql = `CREATE POLICY "${policyName}" ON "${schema}"."${table}" FOR ${command} TO ${role}`;
        if (['SELECT', 'DELETE'].includes(command.toUpperCase())) sql += ` USING (${expression});`;
        else if (command.toUpperCase() === 'INSERT') sql += ` WITH CHECK (${expression});`;
        else sql += ` USING (${expression}) WITH CHECK (${expression});`;
        await pool.query(sql);
        res.json({ success: true });
    } catch(e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/policies', authenticateJWT, requireAdmin, async (req, res) => {
    await pool.query(`DROP POLICY IF EXISTS "${req.body.name}" ON "${req.body.schema}"."${req.body.table}"`);
    res.json({ success: true });
});

app.post('/api/sql', authenticateJWT, requireAdmin, async (req, res) => { 
    try { 
        const { query, schema } = req.body;
        const result = await pool.query(query); // Studio SQL runs as postgres admin
        res.json({ rows: result.rows, rowCount: result.rowCount, command: result.command, createdFunction: /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i.test(query) }); 
    } catch (e: any) { res.status(400).json({ error: e.message }); } 
});

// Other basic routes... (omitted for brevity but kept in mind)

app.listen(PORT, () => { console.log(`Inércia API running on port ${PORT}`); });
