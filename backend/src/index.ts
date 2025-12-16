import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pool from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// --- TYPES ---
interface User {
  id: string;
  email: string;
  role: string;
}

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

      // Check if user exists
      const res = await pool.query('SELECT * FROM auth.users WHERE email = $1', [email]);
      let user = res.rows[0];

      if (!user) {
        // Create user
        const insert = await pool.query(
          `INSERT INTO auth.users (email, provider, role) VALUES ($1, 'google', 'user') RETURNING *`,
          [email]
        );
        user = insert.rows[0];
      }
      return done(null, user);
    } catch (err: any) {
      return done(err);
    }
  }));
}

// --- MIDDLEWARE ---
const authenticateJWT = (req: any, res: any, next: any) => {
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
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: "Admin access required" });
  }
};

// --- ROUTES ---

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO auth.users (email, encrypted_password) VALUES ($1, $2) RETURNING id, email, role`,
      [email, hash]
    );
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(`SELECT * FROM auth.users WHERE email = $1`, [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: "User not found" });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.encrypted_password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback', passport.authenticate('google', { session: false }), (req: any, res) => {
  const user = req.user;
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  // Redirect to frontend with token
  res.redirect(`${process.env.FRONTEND_URL}/#/?token=${token}`);
});

// System Routes (Protected)
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'unhealthy', db: 'disconnected' });
  }
});

// Studio: Table Management
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
  // SECURITY WARNING: In a real app, strict validation of schema/table names is required to prevent injection.
  // Using simple alphanumeric regex check here for safety.
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

// Studio: SQL Editor (ADMIN ONLY)
app.post('/api/sql', authenticateJWT, requireAdmin, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Query required" });
  
  // DANGER: Executing raw SQL. Only admins.
  try {
    const result = await pool.query(query);
    res.json({ rows: result.rows, rowCount: result.rowCount, command: result.command });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Studio: Auth Management
app.get('/api/users', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, role, provider, created_at FROM auth.users LIMIT 100');
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
