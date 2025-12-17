import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Table, Shield, LogOut, Terminal, Blocks, Wand2, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../api';

const Sidebar = () => {
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const [branding, setBranding] = useState({ org: 'Inércia', proj: 'Studio' });
  
  useEffect(() => {
    api.get('/config').then(c => {
        if(c.organization && c.project) {
            setBranding({ org: c.organization, proj: c.project });
        }
    }).catch(() => {});
  }, []);

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
        <div className="flex items-center gap-2 mb-1">
            <Terminal className="w-6 h-6 text-emerald-500" />
            <span className="text-lg font-bold text-white tracking-wide truncate">{branding.org}</span>
        </div>
        <div className="text-xs text-slate-500 uppercase tracking-widest mb-8 pl-8">{branding.proj}</div>
        
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

          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t.sidebar.logic}</div>

          <Link to="/logic" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/logic')}`}>
            <Wand2 size={20} />
            <span className="font-medium">{t.sidebar.logic}</span>
          </Link>
          <Link to="/auth" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/auth')}`}>
            <Shield size={20} />
            <span className="font-medium">{t.sidebar.auth}</span>
          </Link>
        </nav>
      </div>
      <div className="mt-auto p-6 border-t border-slate-800 space-y-2">
        <Link to="/extensions" className={`flex items-center gap-3 px-4 py-3 rounded-l-md transition-colors ${isActive('/extensions')}`}>
            <Blocks size={20} />
            <span className="font-medium">{t.sidebar.extensions}</span>
        </Link>
        <button onClick={toggleLang} className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white transition-colors w-full rounded-md hover:bg-slate-900">
            <Globe size={20} />
            <span>{language === 'pt' ? 'Português' : 'English'}</span>
        </button>
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 transition-colors w-full rounded-md hover:bg-slate-900">
            <LogOut size={20} />
            <span>{t.sidebar.signout}</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;