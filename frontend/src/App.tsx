import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TableEditor from './pages/TableEditor';
import LogicEditor from './pages/LogicEditor';
import AuthManager from './pages/AuthManager';
import Extensions from './pages/Extensions';
import Sidebar from './components/Sidebar';

// Simple layout wrapper
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      {/* Changed: Removed max-w-7xl and mx-auto. Added w-full to use full available space */}
      <main className="flex-1 overflow-auto bg-slate-900 p-4 w-full">
        <div className="h-full flex flex-col w-full">
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
        <Route path="/logic" element={<ProtectedRoute><LogicEditor /></ProtectedRoute>} />
        <Route path="/extensions" element={<ProtectedRoute><Extensions /></ProtectedRoute>} />
        <Route path="/auth" element={<ProtectedRoute><AuthManager /></ProtectedRoute>} />
      </Routes>
    </HashRouter>
  );
}

export default App;