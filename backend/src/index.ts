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

console.log('CORS Configured for:', allowedOrigins);

app.use(helmet() as any); 
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(null, true); 
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
}));

app.use(express.json({ limit: '50mb' }) as any); // Increased limit for CSV imports
app.use(passport.initialize());

interface User {
  id: string;
  email: string;
  role: string;
}

const getExpiry = () => {
    const envVal = process.env.JWT_EXPIRY;
    if (!envVal) return 3600; 
    if (/^\d+$/.test(envVal)) {
        return parseInt(envVal, 10);
    }
    return envVal;
}
const TOKEN_EXPIRY_VALUE = getExpiry();

const ensureRole = async (user: any) => {
    try {
        const countRes = await pool.query('SELECT count(*) FROM auth.users');
        const count = parseInt(countRes.rows[0].count);
        if ((count === 1 || user.email === 'admin@inercia.io') && user.role !== 'admin') {
            await pool.query("UPDATE auth.users SET role = 'admin' WHERE id = $1", [user.id]);
            user.role = 'admin';
        }
    } catch (e) {
        console.error("Role check failed", e);
    }
    return user;
};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || '/api/auth/google/callback',
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
          if (err.name !== 'TokenExpiredError') {
            console.error(`JWT Error: ${err.message}`);
          }
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
    res.status(403).json({ error: "Administrator privileges required", code: "ADMIN_REQUIRED" });
  }
};

// --- ROUTES ---

app.get('/api/config', (req, res) => {
    res.json({
        apiExternalUrl: process.env.API_EXTERNAL_URL || `https://${process.env.API_DOMAIN_NAME}` || 'http://localhost:3000',
        env: process.env.NODE_ENV || 'development'
    });
});

// AUTH ROUTES
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role } = req.body; // Added role support for manual creation
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  
  try {
    const hash = await bcrypt.hash(password, 10);
    const userRole = role || 'user';
    const result = await pool.query(
      `INSERT INTO auth.users (email, encrypted_password, role) VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email 
       RETURNING id, email, role`,
      [email, hash, userRole]
    );
    let user = result.rows[0];
    user = await ensureRole(user);
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ error: "Registration failed." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(`SELECT * FROM auth.users WHERE email = $1`, [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: "User not found" });

    let user = result.rows[0];
    if (!user.encrypted_password) return res.status(401).json({ error: "Please login with Google" });

    const valid = await bcrypt.compare(password, user.encrypted_password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    user = await ensureRole(user);

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role }, 
        process.env.JWT_SECRET as string, 
        { expiresIn: TOKEN_EXPIRY_VALUE as any } 
    );
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/auth/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(500).json({ error: "Google Login not configured." });
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/api/auth/google/callback', passport.authenticate('google', { session: false }), (req: any, res) => {
  const user = req.user;
  const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, 
      process.env.JWT_SECRET as string, 
      { expiresIn: TOKEN_EXPIRY_VALUE as any }
  );
  res.redirect(`/#/auth/callback?token=${token}`);
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', db: 'connected', version: '1.8.0' });
  } catch (e) {
    res.status(500).json({ status: 'unhealthy', db: 'disconnected' });
  }
});

// DATA BROWSER
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

app.get('/api/tables/:schema/:table/meta', authenticateJWT, async (req, res) => {
    const { schema, table } = req.params;
    if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) return res.status(400).json({ error: "Invalid name" });
    try {
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
        `, [schema, table]);
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/tables/:schema/:table/data', authenticateJWT, async (req, res) => {
  const { schema, table } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) return res.status(400).json({ error: "Invalid table name" });
  try {
    const pkRes = await pool.query(`
        SELECT a.attname FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = '"${schema}"."${table}"'::regclass AND i.indisprimary;
    `);
    const pk = pkRes.rows[0]?.attname || 'id';
    const result = await pool.query(`SELECT * FROM "${schema}"."${table}" LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ data: result.rows, pk });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tables/:schema/:table/data', authenticateJWT, async (req, res) => {
    const { schema, table } = req.params;
    const data = req.body;
    if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) return res.status(400).json({ error: "Invalid name" });
    try {
        const columns = Object.keys(data).map(c => `"${c}"`).join(', ');
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO "${schema}"."${table}" (${columns}) VALUES (${placeholders}) RETURNING *`;
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// BULK IMPORT
app.post('/api/tables/:schema/:table/import', authenticateJWT, async (req, res) => {
    const { schema, table } = req.params;
    const { rows } = req.body; // Array of objects
    if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) return res.status(400).json({ error: "Invalid name" });
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "Rows must be an array" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let count = 0;
        for (const row of rows) {
             const columns = Object.keys(row).map(c => `"${c}"`).join(', ');
             const values = Object.values(row);
             const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
             await client.query(`INSERT INTO "${schema}"."${table}" (${columns}) VALUES (${placeholders})`, values);
             count++;
        }
        await client.query('COMMIT');
        res.json({ success: true, count });
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.put('/api/tables/:schema/:table/data/:id', authenticateJWT, async (req, res) => {
    const { schema, table, id } = req.params;
    const data = req.body;
    const pkColumn = req.query.pk as string || 'id';
    if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) return res.status(400).json({ error: "Invalid name" });
    try {
        const updates = Object.keys(data).map((key, i) => `"${key}" = $${i + 1}`).join(', ');
        const values = Object.values(data);
        values.push(id);
        const query = `UPDATE "${schema}"."${table}" SET ${updates} WHERE "${pkColumn}" = $${values.length} RETURNING *`;
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

app.delete('/api/tables/:schema/:table/data/:id', authenticateJWT, async (req, res) => {
    const { schema, table, id } = req.params;
    const pkColumn = req.query.pk as string || 'id';
    if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) return res.status(400).json({ error: "Invalid name" });
    try {
        await pool.query(`DELETE FROM "${schema}"."${table}" WHERE "${pkColumn}" = $1`, [id]);
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// SCHEMA / TABLE BUILDER
app.post('/api/schemas', authenticateJWT, requireAdmin, async (req, res) => {
    const { name } = req.body;
    if (!/^[a-zA-Z0-9_]+$/.test(name)) return res.status(400).json({ error: "Invalid schema name" });
    try {
        await pool.query(`CREATE SCHEMA IF NOT EXISTS "${name}"`);
        res.json({ success: true });
    } catch(e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/tables/create', authenticateJWT, requireAdmin, async (req, res) => {
    const { name, schema, columns } = req.body;
    const schemaName = schema || 'public';
    if (!name || !columns) return res.status(400).json({error: "Invalid schema definition"});
    try {
        let sql = `CREATE TABLE "${schemaName}"."${name}" (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
        for (const col of columns) {
            sql += `, "${col.name}" ${col.type} ${col.nullable ? '' : 'NOT NULL'}`;
        }
        sql += `);`;
        await pool.query(sql);
        res.json({ success: true, message: `Table ${name} created` });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// EXTENSIONS
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
    try {
        if (action === 'install') {
            await pool.query(`CREATE EXTENSION IF NOT EXISTS "${name}" CASCADE`);
        } else {
            await pool.query(`DROP EXTENSION IF EXISTS "${name}"`);
        }
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// RPC & SQL
app.get('/api/rpc', authenticateJWT, async (req, res) => {
    try {
        const query = `
            SELECT n.nspname as schema, p.proname as name, pg_get_function_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
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
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/sql', authenticateJWT, requireAdmin, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Query required" });
  try {
    const result = await pool.query(query);
    const isFunctionCreate = /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i.test(query);
    res.json({ 
        rows: result.rows, 
        rowCount: result.rowCount, 
        command: result.command,
        createdFunction: isFunctionCreate 
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// USERS MANAGEMENT
app.get('/api/users', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, role, provider, created_at FROM auth.users ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/users/:id', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM auth.users WHERE id = $1', [req.params.id]);
        res.json({success: true});
    } catch(e: any) {
        res.status(500).json({ error: e.message });
    }
});

// RLS POLICIES
app.get('/api/policies', authenticateJWT, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pg_policies');
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/policies', authenticateJWT, requireAdmin, async (req, res) => {
    const { table, role, command, expression, schema } = req.body;
    try {
        // Very basic sanitization, realistically use parameterized SQL for policy creation is hard
        const policyName = `policy_${Date.now()}`;
        const query = `
            ALTER TABLE "${schema}"."${table}" ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "${policyName}" ON "${schema}"."${table}"
            FOR ${command}
            TO ${role}
            USING (${expression});
        `;
        await pool.query(query);
        res.json({ success: true });
    } catch(e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/policies', authenticateJWT, requireAdmin, async (req, res) => {
    const { name, table, schema } = req.body;
    try {
        await pool.query(`DROP POLICY IF EXISTS "${name}" ON "${schema}"."${table}"`);
        res.json({ success: true });
    } catch(e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
  console.log(`Inércia API running on port ${PORT}`);
});