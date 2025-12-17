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

// --- CRITICAL: TRUST PROXY FOR NGINX ---
// This ensures req.protocol and req.ip are correct when behind Nginx/Cloudflare
app.set('trust proxy', true);

// --- DYNAMIC CORS CONFIGURATION ---
const rawOrigins = process.env.ALLOWED_ORIGINS || '';
// Normalize origins: remove trailing slashes, remove whitespace, remove duplicates
const allowedOrigins = [...new Set(
    rawOrigins.split(',')
        .map(o => o.trim().replace(/\/$/, '')) // Remove trailing slash
        .filter(o => o.length > 0)
)];

// Add FRONTEND_URL automatically if set
if (process.env.FRONTEND_URL) {
    const fe = process.env.FRONTEND_URL.replace(/\/$/, '');
    if (!allowedOrigins.includes(fe)) allowedOrigins.push(fe);
}

console.log('CORS Configured for:', allowedOrigins);

app.use(helmet() as any); 
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile, curl)
    if (!origin) return callback(null, true);
    
    // Normalize incoming origin for comparison
    const cleanOrigin = origin.replace(/\/$/, '');

    if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin: ${origin} not in ${allowedOrigins}`);
      // Don't throw error to avoid crashing, just return false
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
}));

app.use(express.json() as any);
app.use(passport.initialize());

// --- TYPES ---
interface User {
  id: string;
  email: string;
  role: string;
}

const JWT_EXPIRY = process.env.JWT_EXPIRY ? String(process.env.JWT_EXPIRY) : '12h';

// --- HELPER: AUTO-PROMOTE ADMIN ---
// If the user is the only one in the system, make them admin.
const ensureRole = async (user: any) => {
    try {
        const countRes = await pool.query('SELECT count(*) FROM auth.users');
        const count = parseInt(countRes.rows[0].count);
        
        if (count === 1 && user.role !== 'admin') {
            console.log(`Auto-promoting first user ${user.email} to admin.`);
            await pool.query("UPDATE auth.users SET role = 'admin' WHERE id = $1", [user.id]);
            user.role = 'admin';
        }
    } catch (e) {
        console.error("Role check failed", e);
    }
    return user;
};

// --- PASSPORT CONFIG ---
if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.CALLBACK_URL,
    passReqToCallback: true 
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0].value;
      if (!email) return done(new Error("No email found"));

      const res = await pool.query('SELECT * FROM auth.users WHERE email = $1', [email]);
      let user = res.rows[0];

      if (!user) {
        const insert = await pool.query(
          `INSERT INTO auth.users (email, provider, role) VALUES ($1, 'google', 'user') RETURNING *`,
          [email]
        );
        user = insert.rows[0];
      }
      
      user = await ensureRole(user);

      return done(null, user);
    } catch (err: any) {
      console.error("OAuth Error:", err);
      return done(err);
    }
  }));
}

// --- MIDDLEWARE ---
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
      if (err) {
          console.error(`JWT Verify Error: ${err.message}`);
          return res.status(403).json({ error: "Session expired or invalid token", code: "AUTH_INVALID" });
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'service_role')) {
    next();
  } else {
    console.warn(`Access denied for user ${req.user?.email} (role: ${req.user?.role}) to Admin Route`);
    res.status(403).json({ error: "Administrator privileges required", code: "ADMIN_REQUIRED" });
  }
};

// --- ROUTES ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO auth.users (email, encrypted_password) VALUES ($1, $2) RETURNING id, email, role`,
      [email, hash]
    );
    let user = result.rows[0];
    user = await ensureRole(user);
    res.json(user);
  } catch (e: any) {
    console.error("Register Error:", e);
    res.status(500).json({ error: "Registration failed." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt for: ${email}`);
  
  try {
    const result = await pool.query(`SELECT * FROM auth.users WHERE email = $1`, [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: "User not found" });

    let user = result.rows[0];
    if (!user.encrypted_password) return res.status(401).json({ error: "Please login with Google" });

    const valid = await bcrypt.compare(password, user.encrypted_password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    // Check roles on every login
    user = await ensureRole(user);

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role }, 
        process.env.JWT_SECRET as string, 
        { expiresIn: JWT_EXPIRY as any } 
    );
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e: any) {
    console.error("Login Critical Error:", e);
    res.status(500).json({ error: "Internal Server Error: " + e.message });
  }
});

app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback', passport.authenticate('google', { session: false }), (req: any, res) => {
  const user = req.user;
  const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, 
      process.env.JWT_SECRET as string, 
      { expiresIn: JWT_EXPIRY as any }
  );
  res.redirect(`/#/auth/callback?token=${token}`);
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', db: 'connected', version: '1.5.0' });
  } catch (e) {
    res.status(500).json({ status: 'unhealthy', db: 'disconnected' });
  }
});

// Studio Routes
app.get('/api/tables', authenticateJWT, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name
    `);
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tables/:schema/:table/data', authenticateJWT, async (req, res) => {
  const { schema, table } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  
  if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) {
     return res.status(400).json({ error: "Invalid table name" });
  }

  try {
    const result = await pool.query(`SELECT * FROM "${schema}"."${table}" LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tables/create', authenticateJWT, requireAdmin, async (req, res) => {
    const { name, columns } = req.body;
    if (!name || !columns) return res.status(400).json({error: "Invalid schema definition"});

    try {
        let sql = `CREATE TABLE public."${name}" (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
        
        for (const col of columns) {
            sql += `, "${col.name}" ${col.type} ${col.nullable ? '' : 'NOT NULL'}`;
        }
        sql += `);`;

        await pool.query(sql);
        res.json({ success: true, message: `Table ${name} created` });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/extensions', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const installed = await pool.query('SELECT extname FROM pg_extension');
        const available = await pool.query('SELECT name, comment FROM pg_available_extensions ORDER BY name');
        
        const installedSet = new Set(installed.rows.map(r => r.extname));
        const extensions = available.rows.map(ext => ({
            name: ext.name,
            description: ext.comment,
            installed: installedSet.has(ext.name)
        }));
        
        res.json(extensions);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/extensions', authenticateJWT, requireAdmin, async (req, res) => {
    const { name, action } = req.body;
    console.log(`Extension action: ${action} ${name}`);
    try {
        if (action === 'install') {
            await pool.query(`CREATE EXTENSION IF NOT EXISTS "${name}" CASCADE`);
        } else {
            await pool.query(`DROP EXTENSION IF EXISTS "${name}"`);
        }
        res.json({ success: true });
    } catch (e: any) {
        console.error("Extension Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/rpc', authenticateJWT, async (req, res) => {
    try {
        const query = `
            SELECT n.nspname as schema, p.proname as name, pg_get_function_arguments(p.oid) as args
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            ORDER BY n.nspname, p.proname;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/rpc/:functionName', authenticateJWT, async (req, res) => {
    const { functionName } = req.params;
    const params = req.body; 
    
    try {
        const values = Object.values(params || {});
        const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
        const result = await pool.query(`SELECT * FROM "${functionName}"(${placeholders})`, values);
        res.json(result.rows);
    } catch (e: any) {
        console.error("RPC Error:", e);
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/sql', authenticateJWT, requireAdmin, async (req, res) => {
  const { query } = req.body;
  console.log("Executing SQL:", query);
  if (!query) return res.status(400).json({ error: "Query required" });
  
  try {
    const result = await pool.query(query);
    res.json({ rows: result.rows, rowCount: result.rowCount, command: result.command });
  } catch (e: any) {
    console.error("SQL Error:", e);
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/users', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, role, provider, created_at FROM auth.users ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/policies', authenticateJWT, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pg_policies');
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Inércia API running on port ${PORT}`);
});