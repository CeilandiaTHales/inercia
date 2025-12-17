-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create Auth Schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Create Users Table
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    encrypted_password TEXT,
    provider VARCHAR(50) DEFAULT 'email',
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Default Admin (Password: admin123)
INSERT INTO auth.users (email, encrypted_password, role, provider)
VALUES (
    'admin@inercia.io',
    crypt('admin123', gen_salt('bf')),
    'admin',
    'email'
) ON CONFLICT (email) DO NOTHING;

-- Create Public Dummy Data
CREATE TABLE IF NOT EXISTS public.products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert dummy products
INSERT INTO public.products (name, price, stock) VALUES
('Quantum Processor', 999.99, 50),
('Neural Interface', 4500.00, 10),
('Holographic Display', 299.50, 100);

-- Insert dummy order for admin
INSERT INTO public.orders (user_id, total, status) 
SELECT id, 1499.99, 'completed' FROM auth.users WHERE email = 'admin@inercia.io';
