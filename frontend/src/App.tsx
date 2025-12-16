import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TableEditor from './pages/TableEditor';
import SqlEditor from './pages/SqlEditor';
import AuthManager from './pages/AuthManager';
import Sidebar from './components/Sidebar';

// Simple layout wrapper
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('inercia_token');
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

// Auth Callback Handler
const AuthCallback = () => {
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (token) {
        localStorage.setItem('inercia_token', token);
        window.location.hash = '/';
    }
  }, [location]);
  return <div className="text-white p-10">Authenticating...</div>;
};

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/tables" element={<ProtectedRoute><TableEditor /></ProtectedRoute>} />
        <Route path="/sql" element={<ProtectedRoute><SqlEditor /></ProtectedRoute>} />
        <Route path="/auth" element={<ProtectedRoute><AuthManager /></ProtectedRoute>} />
      </Routes>
    </HashRouter>
  );
}

export default App;
