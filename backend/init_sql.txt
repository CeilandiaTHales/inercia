-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create Auth Schema (System Admins)
CREATE SCHEMA IF NOT EXISTS auth;

-- Create System Meta Schema
CREATE SCHEMA IF NOT EXISTS inercia_sys;

-- System Projects Registry
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
);

-- Admin Users (Studio access only)
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    encrypted_password TEXT,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Default Project
INSERT INTO inercia_sys.projects (name, slug, db_url, api_url, internal_port)
VALUES ('Inércia Default', 'default', 'postgres://postgres:qw2silx8ttrevootrxenx3qgjqd2qnfp@postgres:5432/inercia_base', 'http://localhost:3000', 3000)
ON CONFLICT (slug) DO NOTHING;

-- Seed Initial Admin (admin@inercia.io / admin123)
INSERT INTO auth.users (email, encrypted_password, role)
VALUES ('admin@inercia.io', crypt('admin123', gen_salt('bf')), 'admin')
ON CONFLICT (email) DO NOTHING;
