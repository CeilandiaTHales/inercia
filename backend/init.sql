-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. SCHEMAS
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS inercia_sys;

-- 3. TABLES
CREATE TABLE IF NOT EXISTS inercia_sys.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    db_url TEXT NOT NULL,
    api_url TEXT,
    internal_port INTEGER,
    cors_origins TEXT[] DEFAULT '{}',
    jwt_secret TEXT DEFAULT gen_random_uuid()::text,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    encrypted_password TEXT,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SEEDING (Admin e Projeto Inicial)
-- Nota: O password do admin é 'admin123'
DO $$
BEGIN
    -- Cria admin se não existir
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@inercia.io') THEN
        INSERT INTO auth.users (email, encrypted_password, role)
        VALUES ('admin@inercia.io', crypt('admin123', gen_salt('bf')), 'admin');
    END IF;

    -- Cria projeto default se não existir
    -- O db_url será preenchido corretamente pelo backend se estiver vazio, 
    -- mas inserimos um placeholder seguro aqui.
    IF NOT EXISTS (SELECT 1 FROM inercia_sys.projects WHERE slug = 'default') THEN
        INSERT INTO inercia_sys.projects (name, slug, db_url, api_url, internal_port)
        VALUES ('Meu Primeiro Projeto', 'default', 'SYSTEM_INTERNAL', 'http://localhost:3000', 3000);
    END IF;
END $$;
