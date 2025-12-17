
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

// --- SYSTEM INITIALIZATION ---
const setupSystem = async () => {
    if (MODE !== 'CONTROL_PLANE') return;
    const pool = getBasePool();
    try {
        console.log(`[Inércia] Starting in ${MODE} mode...`);
        await pool.query(`CREATE SCHEMA IF NOT EXISTS inercia_sys`);
        await pool.query(`CREATE SCHEMA IF NOT EXISTS auth`);
        // Tables are created via init_sql.txt in Docker
    } catch (e) { 
        console.error("System init error - verify your DATABASE_URL", e); 
    }
};

setupSystem();

// --- CONTEXT MIDDLEWARE ---
// Fix: Use 'any' for 'res' to bypass environments where Express 'Response' type conflicts with global or core Node types
const getContext = (req: any, res: any, next: NextFunction) => {
    (async () => {
        try {
            if (MODE === 'DATA_PLANE') {
                req.projectPool = await getProjectPool('ENV'); 
                req.jwtSecret = process.env.JWT_SECRET;
                return next();
            }
            
            // In Studio (Control Plane), use header to switch context
            const projectId = req.headers['x-project-id'];
            if (projectId) {
                req.projectPool = await getProjectPool(projectId as string);
                req.projectId = projectId;
                const pRes = await getBasePool().query('SELECT jwt_secret FROM inercia_sys.projects WHERE id = $1', [projectId]);
                req.jwtSecret = pRes.rows[0]?.jwt_secret;
            }
            next();
        } catch (err) {
            next(err);
        }
    })();
};

// Fix: Cast helmet and express.json to 'any' to resolve "No overload matches this call" errors
app.use(helmet() as any);
app.use(express.json({ limit: '50mb' }) as any);
app.use(getContext as any);

// Dynamic CORS
// Fix: Use 'any' for req/res to ensure compatibility with standard middleware signatures
app.use((req: any, res: any, next: NextFunction) => {
    cors({ 
        origin: true, // In production, replace with whitelist from DB/ENV
        credentials: true 
    })(req, res, next);
});

// --- AUTH MIDDLEWARE ---
// Fix: Use 'any' for 'res' as Express methods like 'status' and 'json' may be incorrectly reported as missing on the type definition
const authenticate = (req: any, res: any, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, (req.jwtSecret || process.env.JWT_SECRET) as string, (err: any, decoded: any) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token" });
        req.user = decoded;
        next();
    });
};

// --- ROUTES: CONTROL PLANE (Studio Only) ---
if (MODE === 'CONTROL_PLANE') {
    app.get('/api/projects', authenticate, async (req: any, res: any) => {
        const r = await getBasePool().query('SELECT * FROM inercia_sys.projects ORDER BY created_at DESC');
        res.json(r.rows);
    });

    app.post('/api/auth/login', async (req: any, res: any) => {
        const { email, password } = req.body;
        const result = await getBasePool().query(`SELECT * FROM auth.users WHERE email = $1`, [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "User not found" });
        
        const valid = await bcrypt.compare(password, result.rows[0].encrypted_password);
        if (!valid) return res.status(401).json({ error: "Invalid password" });
        
        const token = jwt.sign({ id: result.rows[0].id, role: 'admin' }, process.env.JWT_SECRET as string, { expiresIn: '24h' });
        res.json({ token, user: { email } });
    });
}

// --- ROUTES: DATA PLANE (BaaS API) ---
// Fix: Explicitly use 'any' for response to fix errors where 'status' or 'json' properties are not detected by the compiler
app.get('/api/rest/v1/:table', authenticate, async (req: any, res: any) => {
    if (!req.projectPool) return res.status(400).json({ error: "Project context missing" });
    try {
        const result = await req.projectPool.query(`SELECT * FROM "public"."${req.params.table}" LIMIT 1000`);
        res.json(result.rows);
    } catch (e: any) { 
        res.status(400).json({ error: e.message }); 
    }
});

// Global Error Handler
// Fix: Use 'any' for 'res' to avoid "Property 'status' does not exist" errors in error handling middleware
app.use((err: any, req: Request, res: any, next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
});

app.listen(PORT, () => {
    console.log(`🚀 Inércia ${MODE} is active on port ${PORT}`);
});
