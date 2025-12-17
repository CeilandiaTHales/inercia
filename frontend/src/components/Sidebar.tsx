import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Table, Database, Shield, LogOut, Terminal, PlusSquare, Blocks, Zap, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Sidebar = () => {
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  
  const isActive = (path: string) => location.pathname === path ? 'bg-slate-800 text-emerald-400 border-r-2 border-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-900';

  const handleLogout = () => {
    localStorage.removeItem('inercia_token');
    window.location.reload();
  };

  const toggleLang = () => {
      setLanguage(language === 'pt' ? 'en' : 'pt');
  }

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col flex-shrink-0">
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
                <Terminal className="w-8 h-8 text-emerald-500" />
                <span className="text-xl font-bold text-white tracking-wider">INÉRCIA</span>
            </div>
        </div>
        
        <nav className="space-y-1">
          <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/')}`}>
            <LayoutDashboard size={20} />
            <span className="font-medium">{t.sidebar.dashboard}</span>
          </Link>
          
          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t.sidebar.database}</div>
          
          <Link to="/tables" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/tables')}`}>
            <Table size={20} />
            <span className="font-medium">{t.sidebar.browser}</span>
          </Link>
          <Link to="/tables/new" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/tables/new')}`}>
            <PlusSquare size={20} />
            <span className="font-medium">{t.sidebar.builder}</span>
          </Link>
          <Link to="/extensions" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/extensions')}`}>
            <Blocks size={20} />
            <span className="font-medium">{t.sidebar.extensions}</span>
          </Link>

          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t.sidebar.logic}</div>

          <Link to="/sql" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/sql')}`}>
            <Database size={20} />
            <span className="font-medium">{t.sidebar.sql}</span>
          </Link>
           <Link to="/rpc" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/rpc')}`}>
            <Zap size={20} />
            <span className="font-medium">{t.sidebar.rpc}</span>
          </Link>
          <Link to="/auth" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/auth')}`}>
            <Shield size={20} />
            <span className="font-medium">{t.sidebar.auth}</span>
          </Link>
        </nav>
      </div>
      <div className="mt-auto p-6 border-t border-slate-800 space-y-4">
        <button onClick={toggleLang} className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors w-full">
            <Globe size={20} />
            <span>{language === 'pt' ? 'Português' : 'English'}</span>
        </button>
        <button onClick={handleLogout} className="flex items-center gap-3 text-slate-400 hover:text-red-400 transition-colors w-full">
            <LogOut size={20} />
            <span>{t.sidebar.signout}</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;