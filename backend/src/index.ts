import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getBasePool, getProjectPool } from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
// SYSTEM_MODE can be 'CONTROL_PLANE' or 'DATA_PLANE'
const MODE = process.env.INSTANCE_MODE || 'CONTROL_PLANE'; 

app.set('trust proxy', true);

// --- HELPER: NGINX CONFIG GENERATOR ---
const generateNginxConfig = (project: any) => {
    return `
# Inércia Project: ${project.name} (${project.slug})
server {
    listen 80;
    server_name ${project.api_url.replace(/^https?:\/\//, '')};

    location / {
        proxy_pass http://localhost:${project.internal_port || 3001};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Security: Injection of Project Context
        proxy_set_header x-inercia-project-id "${project.id}";
    }
}
    `.trim();
};

// --- SYSTEM INITIALIZATION (CONTROL PLANE ONLY) ---
const setupSystem = async () => {
    if (MODE !== 'CONTROL_PLANE') return;
    const pool = getBasePool();
    try {
        await pool.query(`CREATE SCHEMA IF NOT EXISTS inercia_sys`);
        await pool.query(`CREATE SCHEMA IF NOT EXISTS auth`);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inercia_sys.projects (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(100) UNIQUE NOT NULL,
                db_url TEXT NOT NULL,
                api_url TEXT UNIQUE,
                internal_port INTEGER,
                cors_origins TEXT[] DEFAULT '{}',
                jwt_secret TEXT DEFAULT gen_random_uuid()::text,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
    } catch (e) { console.error("System init error", e); }
};

setupSystem();

// --- MIDDLEWARE: CONTEXT RESOLUTION ---
// Fixed: Refactored getContext to a non-async function that returns void.
// This satisfies the Express RequestHandler type and avoids overload resolution issues in TypeScript.
const getContext = (req: any, res: any, next: any) => {
    (async () => {
        if (MODE === 'DATA_PLANE') {
            // In DATA_PLANE mode, the DB and Secret are fixed from ENV
            // This instance only serves ONE project.
            req.projectPool = await getProjectPool('ENV'); 
            req.jwtSecret = process.env.JWT_SECRET;
            return next();
        }
        
        // In CONTROL_PLANE mode (The Studio), we manage multiple projects
        const projectId = req.headers['x-project-id'];
        if (projectId) {
            req.projectPool = await getProjectPool(projectId);
            req.projectId = projectId;
            // Fetch project-specific JWT secret for auth management
            const pRes = await getBasePool().query('SELECT jwt_secret FROM inercia_sys.projects WHERE id = $1', [projectId]);
            req.jwtSecret = pRes.rows[0]?.jwt_secret;
        }
        next();
    })().catch(next);
};

app.use(helmet());
app.use(express.json({ limit: '50mb' }));
app.use(getContext);

// Dynamic CORS based on project settings
app.use((req: any, res, next) => {
    const origin = req.headers.origin;
    // Implementation of dynamic CORS check goes here
    cors({ origin: true, credentials: true })(req, res, next);
});

// --- ROUTES ---

// 1. CONTROL PLANE ROUTES (Studio Management)
if (MODE === 'CONTROL_PLANE') {
    app.get('/api/projects', async (req, res) => {
        const r = await getBasePool().query('SELECT * FROM inercia_sys.projects ORDER BY created_at DESC');
        res.json(r.rows);
    });

    app.get('/api/projects/:id/nginx', async (req, res) => {
        const r = await getBasePool().query('SELECT * FROM inercia_sys.projects WHERE id = $1', [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ error: "Project not found" });
        res.json({ config: generateNginxConfig(r.rows[0]) });
    });

    app.post('/api/auth/login', async (req, res) => {
        const { email, password } = req.body;
        const result = await getBasePool().query(`SELECT * FROM auth.users WHERE email = $1`, [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Admin User not found" });
        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.encrypted_password);
        if (!valid) return res.status(401).json({ error: "Invalid password" });
        const token = jwt.sign({ id: user.id, role: 'admin' }, process.env.JWT_SECRET as string, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, email: user.email, role: 'admin' } });
    });
}

// 2. DATA PLANE / SCOPED ROUTES (The actual BaaS functionality)
app.get('/api/rest/v1/:table', async (req: any, res) => {
    if (!req.projectPool) return res.status(400).json({ error: "Project context not identified" });
    try {
        const result = await req.projectPool.query(`SELECT * FROM "public"."${req.params.table}"`);
        res.json(result.rows);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ... other routes (SQL, RPC) use req.projectPool

app.listen(PORT, () => { console.log(`Inércia ${MODE} running on port ${PORT}`); });