import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Table, Shield, LogOut, Terminal, Blocks, Wand2, Globe, ChevronDown, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../api';

const Sidebar = () => {
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
        const data = await api.get('/projects');
        setProjects(data);
        const savedId = localStorage.getItem('inercia_active_project');
        const active = data.find((p:any) => p.id === savedId) || data[0];
        if (active) {
            setActiveProject(active);
            localStorage.setItem('inercia_active_project', active.id);
        }
    } catch(e) {}
  };

  const switchProject = (p: any) => {
      setActiveProject(p);
      localStorage.setItem('inercia_active_project', p.id);
      setShowProjectDropdown(false);
      window.location.reload(); // Hard reload to clear all scoped caches
  };

  const isActive = (path: string) => location.pathname === path ? 'bg-slate-800 text-emerald-400 border-r-2 border-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-900';

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col flex-shrink-0 z-40">
      
      {/* Project Selector */}
      <div className="relative p-4 border-b border-slate-800">
          <button 
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className="w-full flex items-center justify-between bg-slate-900 border border-slate-700 p-2 rounded-lg hover:border-emerald-500 transition-colors group"
          >
              <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                      {activeProject?.name?.charAt(0) || 'P'}
                  </div>
                  <span className="text-sm font-bold text-white truncate">{activeProject?.name || 'Selecionar Projeto'}</span>
              </div>
              <ChevronDown size={14} className="text-slate-500 group-hover:text-emerald-400" />
          </button>

          {showProjectDropdown && (
              <div className="absolute top-full left-4 right-4 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in">
                  <div className="max-h-60 overflow-y-auto">
                      {projects.map(p => (
                          <button 
                            key={p.id}
                            onClick={() => switchProject(p)}
                            className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-slate-800 transition-colors ${activeProject?.id === p.id ? 'text-emerald-400 bg-slate-800/50' : 'text-slate-300'}`}
                          >
                              <span className="truncate pr-2">{p.name}</span>
                              {activeProject?.id === p.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>}
                          </button>
                      ))}
                  </div>
                  <button className="w-full p-3 text-xs text-slate-500 hover:text-white hover:bg-slate-800 border-t border-slate-700 flex items-center gap-2 justify-center transition-colors">
                      <Plus size={14}/> Criar Novo Projeto
                  </button>
              </div>
          )}
      </div>

      <div className="flex-1 p-4">
        <nav className="space-y-1">
          <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${isActive('/')}`}>
            <LayoutDashboard size={20} />
            <span className="font-medium">{t.sidebar.dashboard}</span>
          </Link>
          
          <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">{t.sidebar.database}</div>
          
          <Link to="/tables" className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${isActive('/tables')}`}>
            <Table size={20} />
            <span className="font-medium">{t.sidebar.browser}</span>
          </Link>

          <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">{t.sidebar.logic}</div>

          <Link to="/logic" className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${isActive('/logic')}`}>
            <Wand2 size={20} />
            <span className="font-medium">{t.sidebar.logic}</span>
          </Link>
          <Link to="/auth" className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${isActive('/auth')}`}>
            <Shield size={20} />
            <span className="font-medium">{t.sidebar.auth}</span>
          </Link>
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <Link to="/extensions" className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${isActive('/extensions')}`}>
            <Blocks size={20} />
            <span className="font-medium">{t.sidebar.extensions}</span>
        </Link>
        <button onClick={() => setLanguage(language === 'pt' ? 'en' : 'pt')} className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white transition-colors w-full rounded hover:bg-slate-900">
            <Globe size={20} />
            <span>{language === 'pt' ? 'Português' : 'English'}</span>
        </button>
        <button onClick={() => { localStorage.removeItem('inercia_token'); window.location.reload(); }} className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 transition-colors w-full rounded hover:bg-slate-900">
            <LogOut size={20} />
            <span>{t.sidebar.signout}</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;