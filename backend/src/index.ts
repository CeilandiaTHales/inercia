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

// --- INITIALIZATION & SYSTEM SETUP ---
const setupSystem = async () => {
    try {
        await pool.query(`CREATE SCHEMA IF NOT EXISTS inercia_sys`);
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
        
        // Auth Providers Table (Dynamic Auth)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS auth.providers (
                id VARCHAR(50) PRIMARY KEY, -- 'google', 'github', 'apple'
                client_id TEXT,
                client_secret TEXT,
                enabled BOOLEAN DEFAULT false,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Ensure Super Admin exists based on ENV
        const superEmail = process.env.SUPER_ADMIN_EMAIL;
        const superPass = process.env.SUPER_ADMIN_PASSWORD;
        
        if (superEmail && superPass) {
            const hash = await bcrypt.hash(superPass, 10);
            const userRes = await pool.query(`SELECT * FROM auth.users WHERE email = $1`, [superEmail]);
            
            if (userRes.rows.length === 0) {
                console.log(`Creating Super Admin: ${superEmail}`);
                await pool.query(
                    `INSERT INTO auth.users (email, encrypted_password, role, provider) VALUES ($1, $2, 'admin', 'email')`,
                    [superEmail, hash]
                );
            } else {
                await pool.query(
                    `UPDATE auth.users SET encrypted_password = $1, role = 'admin' WHERE email = $2`,
                    [hash, superEmail]
                );
            }
        }
        
        // Initialize Dynamic Strategies
        await refreshAuthStrategies();

    } catch (e) {
        console.error("System init error", e);
    }
};

// Function to reload strategies from DB without restarting server
const refreshAuthStrategies = async () => {
    try {
        const res = await pool.query("SELECT * FROM auth.providers WHERE enabled = true");
        const providers = res.rows;
        
        // Unuse existing to avoid duplicates if re-running
        passport.unuse('google');

        providers.forEach(p => {
            if (p.id === 'google' && p.client_id && p.client_secret) {
                console.log("Initializing Google OAuth Strategy from Database Config...");
                passport.use(new GoogleStrategy({
                    clientID: p.client_id,
                    clientSecret: p.client_secret,
                    callbackURL: process.env.CALLBACK_URL || '/api/auth/google/callback',
                    passReqToCallback: true
                }, async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {
                    try {
                        const email = profile.emails?.[0].value;
                        if (!email) return done(new Error("No email found"));

                        // Upsert User
                        const userRes = await pool.query('SELECT * FROM auth.users WHERE email = $1', [email]);
                        let user = userRes.rows[0];

                        if (!user) {
                            // Default role is user. Admin role comes from ENV override or manual SQL update.
                            const insert = await pool.query(
                                `INSERT INTO auth.users (email, provider, role) VALUES ($1, 'google', 'user') RETURNING *`, 
                                [email]
                            );
                            user = insert.rows[0];
                        }
                        return done(null, user);
                    } catch (err: any) { return done(err); }
                }));
            }
            // Future: Add GitHub, Apple, etc here
        });
    } catch (e) {
        console.error("Failed to load auth strategies", e);
    }
};

setupSystem();

// --- MIDDLEWARE ---
const rawOrigins = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = [...new Set(
    rawOrigins.split(',')
        .map(o => o.trim().replace(/\/$/, ''))
        .filter(o => o.length > 0)
)];

if (process.env.FRONTEND_URL) {
    const fe = process.env.FRONTEND_URL.replace(/\/$/, '');
    if (!allowedOrigins.includes(fe)) allowedOrigins.push(fe);
}

allowedOrigins.push('http://localhost:3000');
allowedOrigins.push('http://127.0.0.1:3000');

app.use(helmet() as any); 
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    // Allow strict list in prod, loose in dev if needed
    callback(null, true); 
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
}));

app.use(express.json({ limit: '50mb' }) as any);
app.use(passport.initialize());

// --- AUTH HELPERS ---
const getExpiry = () => {
    const envVal = process.env.JWT_EXPIRY;
    if (!envVal) return 3600; 
    if (/^\d+$/.test(envVal)) return parseInt(envVal, 10);
    return envVal;
}
const TOKEN_EXPIRY_VALUE = getExpiry();

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
      if (err) return res.status(403).json({ error: "Session expired", code: "AUTH_INVALID" });
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: "Auth required", code: "AUTH_REQUIRED" });
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  const superEmail = process.env.SUPER_ADMIN_EMAIL;
  if (req.user && (req.user.role === 'admin' || req.user.role === 'service_role' || req.user.email === superEmail)) {
      next();
  } else {
      res.status(403).json({ error: "Dashboard Access Denied.", code: "ADMIN_REQUIRED" });
  }
};

// --- ROUTES ---

// CONFIG
app.get('/api/config', (req, res) => {
    res.json({
        apiExternalUrl: process.env.API_EXTERNAL_URL || 'http://localhost:3000',
        organization: process.env.STUDIO_DEFAULT_ORGANIZATION || 'Inércia Org',
        project: process.env.STUDIO_DEFAULT_PROJECT || 'Inércia Project',
        env: process.env.NODE_ENV || 'development'
    });
});

// STATS
app.get('/api/stats', authenticateJWT, async (req, res) => {
    try {
        const dbStats = await pool.query(`
            SELECT 
                (SELECT count(*) FROM auth.users) as user_count,
                (SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')) as table_count,
                (SELECT sum(numbackends) FROM pg_stat_database) as active_connections,
                (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries
        `);
        res.json(dbStats.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// --- AUTHENTICATION ---

// 1. Email/Pass Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const superEmail = process.env.SUPER_ADMIN_EMAIL;
  try {
    const result = await pool.query(`SELECT * FROM auth.users WHERE email = $1`, [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: "User not found" });
    let user = result.rows[0];
    
    // For Dashboard access, strict check
    if (user.role !== 'admin' && user.email !== superEmail) {
        return res.status(403).json({ error: "Access Denied: Dashboard is for Admins only." });
    }

    if (!user.encrypted_password) return res.status(401).json({ error: "Use Social Login" });
    const valid = await bcrypt.compare(password, user.encrypted_password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: TOKEN_EXPIRY_VALUE as any });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e: any) { res.status(500).json({ error: "Internal Error" }); }
});

// 2. Google OAuth Routes
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/api/auth/google/callback', passport.authenticate('google', { session: false }), (req: any, res) => {
    const token = jwt.sign(
        { id: req.user.id, email: req.user.email, role: req.user.role }, 
        process.env.JWT_SECRET as string, 
        { expiresIn: TOKEN_EXPIRY_VALUE as any }
    );
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || ''}/auth/callback?token=${token}`);
});

// 3. User Registration (Admin Only or via API)
app.post('/api/auth/register', authenticateJWT, requireAdmin, async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO auth.users (email, encrypted_password, role) VALUES ($1, $2, $3) RETURNING id, email, role`,
      [email, hash, role || 'user']
    );
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: "Registration failed" }); }
});

// --- PROVIDER MANAGEMENT (Dynamic Auth) ---
app.get('/api/auth/providers', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        // Return sensitive info masked or full? For admin panel, full is usually needed to edit.
        const r = await pool.query("SELECT id, client_id, client_secret, enabled, updated_at FROM auth.providers");
        res.json(r.rows);
    } catch (e:any) { res.status(500).json({error: e.message}); }
});

app.post('/api/auth/providers', authenticateJWT, requireAdmin, async (req, res) => {
    const { id, client_id, client_secret, enabled } = req.body;
    try {
        await pool.query(`
            INSERT INTO auth.providers (id, client_id, client_secret, enabled, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (id) DO UPDATE 
            SET client_id = EXCLUDED.client_id, 
                client_secret = EXCLUDED.client_secret, 
                enabled = EXCLUDED.enabled,
                updated_at = NOW()
        `, [id, client_id, client_secret, enabled]);
        
        // Reload strategies immediately
        await refreshAuthStrategies();
        
        res.json({ success: true });
    } catch (e:any) { res.status(500).json({error: e.message}); }
});


// --- DATA ROUTES (Tables, RLS, etc) ---
app.get('/api/tables', authenticateJWT, async (req, res) => {
  try {
    const result = await pool.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'inercia_sys') ORDER BY table_schema, table_name`);
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tables/:schema/:table/meta', authenticateJWT, async (req, res) => {
    const { schema, table } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) return res.status(400).json({ error: "Invalid" });
    try {
        const result = await pool.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`, [schema, table]);
        res.json(result.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tables/:schema/:table/data', authenticateJWT, async (req, res) => {
  const { schema, table } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  try {
    const pkRes = await pool.query(`SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = '"${schema}"."${table}"'::regclass AND i.indisprimary;`);
    const pk = pkRes.rows[0]?.attname || 'id';
    const result = await pool.query(`SELECT * FROM "${schema}"."${table}" LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ data: result.rows, pk });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tables/:schema/:table/data', authenticateJWT, async (req, res) => {
    const { schema, table } = req.params;
    try {
        const columns = Object.keys(req.body).map(c => `"${c}"`).join(', ');
        const values = Object.values(req.body);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const result = await pool.query(`INSERT INTO "${schema}"."${table}" (${columns}) VALUES (${placeholders}) RETURNING *`, values);
        res.json(result.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.put('/api/tables/:schema/:table/data/:id', authenticateJWT, async (req, res) => {
    const { schema, table, id } = req.params;
    const pkColumn = req.query.pk as string || 'id';
    try {
        const updates = Object.keys(req.body).map((key, i) => `"${key}" = $${i + 1}`).join(', ');
        const values = Object.values(req.body);
        values.push(id);
        const result = await pool.query(`UPDATE "${schema}"."${table}" SET ${updates} WHERE "${pkColumn}" = $${values.length} RETURNING *`, values);
        res.json(result.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/tables/:schema/:table/data/:id', authenticateJWT, async (req, res) => {
    const { schema, table, id } = req.params;
    const pkColumn = req.query.pk as string || 'id';
    try {
        await pool.query(`DELETE FROM "${schema}"."${table}" WHERE "${pkColumn}" = $1`, [id]);
        res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// FILES (Real Save)
app.get('/api/files', authenticateJWT, async (req, res) => {
    try { const r = await pool.query(`SELECT id, name, content, schema_name, type FROM inercia_sys.files`); res.json(r.rows); } catch(e:any) { res.status(500).json({error:e.message}); }
});
app.post('/api/files', authenticateJWT, requireAdmin, async (req, res) => {
    const { name, content, schema_name, type } = req.body;
    try {
        const r = await pool.query(`INSERT INTO inercia_sys.files (name, content, schema_name, type) VALUES ($1, $2, $3, $4) RETURNING id`, [name, content, schema_name || 'principal', type || 'txt']);
        res.json({success:true, id: r.rows[0].id});
    } catch(e:any) { res.status(500).json({error:e.message}); }
});
app.put('/api/files/:id', authenticateJWT, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    try { await pool.query(`UPDATE inercia_sys.files SET content = $1, updated_at = NOW() WHERE id = $2`, [content, id]); res.json({success:true}); } catch(e:any) { res.status(500).json({error:e.message}); }
});

// RLS
app.get('/api/policies', authenticateJWT, async (req, res) => {
    const r = await pool.query('SELECT * FROM pg_policies'); res.json(r.rows);
});
app.post('/api/policies', authenticateJWT, requireAdmin, async (req, res) => {
    const { table, role, command, expression, schema } = req.body;
    try {
        const policyName = `policy_${table}_${command}_${Date.now()}`;
        let sql = `ALTER TABLE "${schema}"."${table}" ENABLE ROW LEVEL SECURITY; CREATE POLICY "${policyName}" ON "${schema}"."${table}" FOR ${command} TO ${role}`;
        if (['SELECT', 'DELETE'].includes(command.toUpperCase())) sql += ` USING (${expression});`;
        else if (command.toUpperCase() === 'INSERT') sql += ` WITH CHECK (${expression});`;
        else sql += ` USING (${expression}) WITH CHECK (${expression});`;
        await pool.query(sql); res.json({ success: true });
    } catch(e: any) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/policies', authenticateJWT, requireAdmin, async (req, res) => {
    try { await pool.query(`DROP POLICY IF EXISTS "${req.body.name}" ON "${req.body.schema}"."${req.body.table}"`); res.json({ success: true }); } catch(e: any) { res.status(500).json({ error: e.message }); }
});

// CSV Import, Schemas, RPC, SQL, Users, Extensions, Tables Create
// (Keeping existing standard CRUD endpoints logic condensed for brevity as they remain unchanged)
app.post('/api/import/csv', authenticateJWT, requireAdmin, async (req, res) => {
    const { schema, table, rows, createTable } = req.body;
    if (!rows || rows.length === 0) return res.status(400).json({ error: "Empty CSV" });
    const schemaName = schema || 'public';
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (createTable) {
            const headers = Object.keys(rows[0]);
            let columnsSql = [];
            for (const header of headers) {
                let detectedType = 'TEXT'; 
                const value = rows.find((r: any) => r[header] !== null && r[header] !== '')?.[header];
                if (value !== undefined) {
                    if (!isNaN(Number(value))) detectedType = value.includes('.') ? 'NUMERIC' : 'INTEGER';
                    else if (['true', 'false'].includes(String(value).toLowerCase())) detectedType = 'BOOLEAN';
                    else if (!isNaN(Date.parse(value)) && value.includes('-')) detectedType = 'TIMESTAMP';
                }
                columnsSql.push(`"${header}" ${detectedType}`);
            }
            await client.query(`CREATE TABLE IF NOT EXISTS "${schemaName}"."${table}" (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), ${columnsSql.join(', ')}, created_at TIMESTAMP DEFAULT NOW())`);
        }
        let inserted = 0;
        for (const row of rows) {
             const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
             const vals = Object.values(row);
             const params = vals.map((_, i) => `$${i + 1}`).join(', ');
             await client.query(`INSERT INTO "${schemaName}"."${table}" (${cols}) VALUES (${params})`, vals);
             inserted++;
        }
        await client.query('COMMIT'); res.json({ success: true, inserted });
    } catch (e: any) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); } finally { client.release(); }
});

app.get('/api/schemas', authenticateJWT, async (req, res) => { try { const r = await pool.query(`SELECT nspname as name FROM pg_namespace WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')`); res.json(r.rows); } catch(e:any) { res.status(500).json({error: e.message}); } });
app.post('/api/schemas', authenticateJWT, requireAdmin, async (req, res) => { try { await pool.query(`CREATE SCHEMA IF NOT EXISTS "${req.body.name}"`); res.json({ success: true }); } catch(e: any) { res.status(500).json({ error: e.message }); } });
app.put('/api/schemas/:name', authenticateJWT, requireAdmin, async (req, res) => { try { await pool.query(`ALTER SCHEMA "${req.params.name}" RENAME TO "${req.body.newName}"`); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
app.delete('/api/schemas/:name', authenticateJWT, requireAdmin, async (req, res) => { try { await pool.query(`DROP SCHEMA "${req.params.name}" CASCADE`); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
app.get('/api/rpc', authenticateJWT, async (req, res) => { try { const r = await pool.query(`SELECT n.nspname as schema, p.proname as name, pg_get_function_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.proname NOT LIKE 'pg_%' AND p.proname NOT LIKE 'uuid_%' ORDER BY n.nspname, p.proname;`); res.json(r.rows); } catch (e: any) { res.status(500).json({ error: e.message }); } });
app.post('/api/rpc/:functionName', authenticateJWT, async (req, res) => { try { const values = Object.values(req.body || {}); const placeholders = values.map((_, i) => `$${i + 1}`).join(','); const r = await pool.query(`SELECT * FROM "${req.params.functionName}"(${placeholders})`, values); res.json(r.rows); } catch (e: any) { res.status(400).json({ error: e.message }); } });
app.post('/api/sql', authenticateJWT, requireAdmin, async (req, res) => { try { const result = await pool.query(req.body.query); const isFunctionCreate = /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i.test(req.body.query); res.json({ rows: result.rows, rowCount: result.rowCount, command: result.command, createdFunction: isFunctionCreate }); } catch (e: any) { res.status(400).json({ error: e.message }); } });
app.get('/api/users', authenticateJWT, requireAdmin, async (req, res) => { const r = await pool.query('SELECT id, email, role, provider, created_at FROM auth.users ORDER BY created_at DESC LIMIT 100'); res.json(r.rows); });
app.delete('/api/users/:id', authenticateJWT, requireAdmin, async (req, res) => { await pool.query('DELETE FROM auth.users WHERE id = $1', [req.params.id]); res.json({success:true}); });
app.post('/api/tables/create', authenticateJWT, requireAdmin, async (req, res) => { const { name, schema, columns } = req.body; try { let sql = `CREATE TABLE "${schema||'public'}"."${name}" (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`; for (const col of columns) sql += `, "${col.name}" ${col.type} ${col.nullable ? '' : 'NOT NULL'}`; sql += `);`; await pool.query(sql); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
app.get('/api/extensions', authenticateJWT, requireAdmin, async (req, res) => { try { const installed = await pool.query('SELECT extname FROM pg_extension'); const available = await pool.query('SELECT name, comment FROM pg_available_extensions ORDER BY name'); const installedSet = new Set(installed.rows.map(r => r.extname)); res.json(available.rows.map(ext => ({name: ext.name, description: ext.comment, installed: installedSet.has(ext.name)}))); } catch (e: any) { res.status(500).json({ error: e.message }); } });
app.post('/api/extensions', authenticateJWT, requireAdmin, async (req, res) => { try { const query = req.body.action === 'install' ? `CREATE EXTENSION IF NOT EXISTS "${req.body.name}" CASCADE` : `DROP EXTENSION IF EXISTS "${req.body.name}"`; await pool.query(query); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

app.listen(PORT, () => { console.log(`Inércia API running on port ${PORT}`); });