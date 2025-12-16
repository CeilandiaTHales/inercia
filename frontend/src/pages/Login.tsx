import React, { useState } from 'react';
import { api } from '../api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const res = await api.post('/auth/login', { email, password });
        if (res.token) {
            localStorage.setItem('inercia_token', res.token);
            window.location.hash = '/';
            window.location.reload();
        } else {
            setError(res.error || 'Login failed');
        }
    } catch (err: any) {
        setError('Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 p-8 rounded-lg border border-slate-800 w-full max-w-md shadow-2xl">
            <h1 className="text-3xl font-bold text-white mb-2 text-center tracking-wider">INÉRCIA</h1>
            <p className="text-slate-500 text-center mb-8">Production BaaS Studio</p>

            {error && <div className="bg-red-900/20 text-red-400 p-3 rounded mb-4 text-sm border border-red-900">{error}</div>}

            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-slate-400 text-sm mb-1">Email</label>
                    <input 
                        type="email" 
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 focus:outline-none"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-slate-400 text-sm mb-1">Password</label>
                    <input 
                        type="password" 
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 focus:outline-none"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded transition-colors">
                    Access Console
                </button>
            </form>

            <div className="mt-6 border-t border-slate-800 pt-6">
                <p className="text-center text-slate-500 text-sm mb-4">Or continue with</p>
                <a 
                    href="http://localhost:3000/api/auth/google" 
                    className="flex items-center justify-center gap-2 w-full bg-white text-slate-900 font-bold py-2 rounded hover:bg-slate-200 transition-colors"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                </a>
            </div>
        </div>
    </div>
  );
};

export default Login;
