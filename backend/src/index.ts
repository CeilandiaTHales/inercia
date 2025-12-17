import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getBasePool, getProjectPool } from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MODE = process.env.INSTANCE_MODE || 'CONTROL_PLANE'; 

app.set('trust proxy', true);

// --- BOOTSTRAP: Ensure System is Ready ---
const bootstrap = async () => {
    console.log(`[System] Starting bootstrap in ${MODE} mode...`);
    const pool = getBasePool();
    let retries = 5;
    
    while (retries > 0) {
        try {
            await pool.query('SELECT 1');
            console.log("[System] Database connected successfully.");
            break;
        } catch (err) {
            console.log(`[System] Waiting for database... (${retries} retries left)`);
            retries--;
            await new Promise(res => setTimeout(res, 3000));
        }
    }

    if (MODE === 'CONTROL_PLANE') {
        try {
            // 1. Ensure Admin exists
            const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@inercia.io';
            const adminPass = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
            const userCheck = await pool.query('SELECT * FROM auth.users WHERE email = $1', [adminEmail]);
            
            if (userCheck.rows.length === 0) {
                console.log(`[System] Seeding super admin: ${adminEmail}`);
                const hashed = await bcrypt.hash(adminPass, 10);
                await pool.query(
                    'INSERT INTO auth.users (email, encrypted_password, role) VALUES ($1, $2, $3)',
                    [adminEmail, hashed, 'admin']
                );
            }

            // 2. Ensure Default Project exists
            const projCheck = await pool.query("SELECT * FROM inercia_sys.projects WHERE slug = 'default'");
            if (projCheck.rows.length === 0) {
                console.log("[System] Seeding default project...");
                await pool.query(
                    "INSERT INTO inercia_sys.projects (name, slug, db_url, api_url, internal_port) VALUES ($1, $2, $3, $4, $5)",
                    ['Meu Primeiro Projeto', 'default', 'SYSTEM_INTERNAL', 'http://localhost:3000', 3000]
                );
            }
            console.log("[System] Bootstrap complete.");
        } catch (err) {
            console.error("[System] Bootstrap failed:", err);
        }
    }
};

// --- MIDDLEWARES ---
const getContext = (req: any, res: any, next: NextFunction) => {
    (async () => {
        try {
            if (MODE === 'DATA_PLANE') {
                req.projectPool = await getProjectPool('ENV'); 
                req.jwtSecret = process.env.JWT_SECRET;
                return next();
            }
            const projectId = req.headers['x-project-id'];
            if (projectId) {
                req.projectPool = await getProjectPool(projectId as string);
                req.projectId = projectId;
                const pRes = await getBasePool().query('SELECT jwt_secret FROM inercia_sys.projects WHERE id = $1', [projectId]);
                req.jwtSecret = pRes.rows[0]?.jwt_secret;
            }
            next();
        } catch (err) { next(err); }
    })();
};

app.use(helmet() as any);
app.use(express.json({ limit: '50mb' }) as any);
app.use(getContext as any);
app.use((req: any, res: any, next: NextFunction) => {
    cors({ origin: true, credentials: true })(req, res, next);
});

// --- AUTH ---
const authenticate = (req: any, res: any, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET as string, (err: any, decoded: any) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = decoded;
        next();
    });
};

// --- ROUTES: STUDIO ---
if (MODE === 'CONTROL_PLANE') {
    app.post('/api/auth/login', async (req: any, res: any) => {
        const { email, password } = req.body;
        try {
            const result = await getBasePool().query(`SELECT * FROM auth.users WHERE email = $1`, [email]);
            if (result.rows.length === 0) return res.status(401).json({ error: "User not found" });
            
            const valid = await bcrypt.compare(password, result.rows[0].encrypted_password);
            if (!valid) return res.status(401).json({ error: "Invalid credentials" });
            
            const token = jwt.sign(
                { id: result.rows[0].id, role: result.rows[0].role }, 
                process.env.JWT_SECRET as string, 
                { expiresIn: '24h' }
            );
            res.json({ token });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/projects', authenticate, async (req: any, res: any) => {
        const r = await getBasePool().query('SELECT * FROM inercia_sys.projects ORDER BY created_at DESC');
        res.json(r.rows);
    });

    app.post('/api/projects', authenticate, async (req: any, res: any) => {
        const { name, slug, db_url } = req.body;
        try {
            const r = await getBasePool().query(
                'INSERT INTO inercia_sys.projects (name, slug, db_url) VALUES ($1, $2, $3) RETURNING *',
                [name, slug, db_url || 'SYSTEM_INTERNAL']
            );
            res.json(r.rows[0]);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    });

    app.get('/api/stats', authenticate, async (req: any, res: any) => {
        const pool = req.projectPool || getBasePool();
        try {
            const r = await pool.query('SELECT count(*) as count FROM auth.users');
            res.json({ user_count: r.rows[0].count });
        } catch (e) { res.json({ user_count: 0 }); }
    });
}

// --- ROUTES: BAAS API ---
app.get('/api/tables', authenticate, async (req: any, res: any) => {
    const pool = req.projectPool || getBasePool();
    const r = await pool.query(`SELECT table_name, table_schema FROM information_schema.tables WHERE table_schema = 'public'`);
    res.json(r.rows);
});

app.listen(PORT, async () => {
    console.log(`🚀 Inércia ${MODE} online on port ${PORT}.`);
    await bootstrap();
});
