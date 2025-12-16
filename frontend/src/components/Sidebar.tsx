import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Table, Database, Shield, LogOut, Terminal } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path ? 'bg-slate-800 text-emerald-400 border-r-2 border-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-900';

  const handleLogout = () => {
    localStorage.removeItem('inercia_token');
    window.location.reload();
  };

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
            <Terminal className="w-8 h-8 text-emerald-500" />
            <span className="text-xl font-bold text-white tracking-wider">INÉRCIA</span>
        </div>
        <nav className="space-y-1">
          <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/')}`}>
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </Link>
          <Link to="/tables" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/tables')}`}>
            <Table size={20} />
            <span className="font-medium">Table Editor</span>
          </Link>
          <Link to="/sql" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/sql')}`}>
            <Database size={20} />
            <span className="font-medium">SQL Editor</span>
          </Link>
          <Link to="/auth" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/auth')}`}>
            <Shield size={20} />
            <span className="font-medium">Auth & RLS</span>
          </Link>
        </nav>
      </div>
      <div className="mt-auto p-6 border-t border-slate-800">
        <button onClick={handleLogout} className="flex items-center gap-3 text-slate-400 hover:text-red-400 transition-colors w-full">
            <LogOut size={20} />
            <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
