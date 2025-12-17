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

// --- DYNAMIC CORS CONFIGURATION ---
const rawOrigins = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins: string[] = [];

try {
    rawOrigins.split(',').forEach(origin => {
        let clean = origin.trim();
        if (clean) {
            if (clean.endsWith('/')) clean = clean.slice(0, -1);
            if (clean.endsWith('/*')) clean = clean.slice(0, -2);
            allowedOrigins.push(clean);
        }
    });
} catch (e) {
    console.error("Error parsing ALLOWED_ORIGINS", e);
}

// Add FRONTEND_URL automatically
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
}

console.log('CORS Allowed Origins:', allowedOrigins);

app.use(helmet() as any); 
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    // Loose matching for debugging issues with protocols
    const isAllowed = allowedOrigins.some(allowed => origin.includes(allowed) || allowed === '*');
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from: ${origin}`);
      callback(null, false); // Don't throw error, just deny
    }
  },
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

// --- PASSPORT CONFIG ---
if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.CALLBACK_URL
  }, async (accessToken, refreshToken, profile, done) => {
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
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'service_role')) {
    next();
  } else {
    res.status(403).json({ error: "Admin access required" });
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
    res.json(result.rows[0]);
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

    const user = result.rows[0];
    if (!user.encrypted_password) return res.status(401).json({ error: "Please login with Google" });

    // Handle pgcrypto legacy hashes if necessary, otherwise use bcrypt
    const valid = await bcrypt.compare(password, user.encrypted_password);
    if (!valid) {
        console.warn(`Invalid password for user: ${email}`);
        return res.status(401).json({ error: "Invalid password" });
    }

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
    res.json({ status: 'healthy', db: 'connected', version: '1.4.0' });
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