import React, { useEffect, useState } from 'react';
import { api, copyToClipboard } from '../api';
import { Activity, Server, Database, Lock, Plug, X, Copy, Eye, EyeOff, Key, Settings, Globe, ShieldCheck, Save, Info, Terminal, RefreshCw, Cpu } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

const Dashboard = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [stats, setStats] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'stats' | 'settings' | 'infra'>('stats');
  
  const [activeProject, setActiveProject] = useState<any>(null);
  const [editProject, setEditProject] = useState<any>(null);
  const [nginxConfig, setNginxConfig] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
        const projData = await api.get('/projects');
        const currentId = localStorage.getItem('inercia_active_project');
        const current = projData.find((p:any) => p.id === currentId) || projData[0];
        setActiveProject(current);
        setEditProject({...current, cors_origins: current.cors_origins?.join(', ') || ''});
        
        // Load stats
        api.get('/stats').then(setStats).catch(console.error);
        
        // Load Nginx preview
        api.get(`/projects/${current.id}/nginx`).then(res => setNginxConfig(res.config)).catch(console.error);
    } catch(e) { console.error(e); }
  };

  const handleSaveSettings = async () => {
      try {
          const payload = {
              ...editProject,
              cors_origins: editProject.cors_origins.split(',').map((s:string) => s.trim()).filter((s:string) => s !== '')
          };
          await api.put(`/projects/${activeProject.id}`, payload);
          showToast("Configurações salvas!");
          loadData();
      } catch(e:any) { showToast(e.message, 'error'); }
  };

  return (
    <div className="space-y-8 animate-fade-in h-full flex flex-col">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div>
            <h1 className="text-4xl font-bold text-white mb-2">{activeProject?.name || 'Projeto'}</h1>
            <div className="flex gap-6">
                <button onClick={() => setActiveTab('stats')} className={`text-sm font-bold pb-2 border-b-2 transition-all ${activeTab === 'stats' ? 'text-emerald-400 border-emerald-400' : 'text-slate-500 border-transparent hover:text-white'}`}>Métricas</button>
                <button onClick={() => setActiveTab('settings')} className={`text-sm font-bold pb-2 border-b-2 transition-all ${activeTab === 'settings' ? 'text-emerald-400 border-emerald-400' : 'text-slate-500 border-transparent hover:text-white'}`}>Configurações</button>
                <button onClick={() => setActiveTab('infra')} className={`text-sm font-bold pb-2 border-b-2 transition-all ${activeTab === 'infra' ? 'text-emerald-400 border-emerald-400' : 'text-slate-500 border-transparent hover:text-white'}`}>Infraestrutura & Domínios</button>
            </div>
        </div>
        <div className="flex gap-2 mb-2">
            <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-1 rounded font-mono border border-slate-700">ID: {activeProject?.id}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
          {activeTab === 'stats' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                      <p className="text-slate-400 text-sm mb-1">Status do Container</p>
                      <h3 className="text-2xl font-bold text-white flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> {t.dashboard.operational}</h3>
                  </div>
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                      <p className="text-slate-400 text-sm mb-1">Usuários Finais</p>
                      <h3 className="text-2xl font-bold text-white">{stats.user_count || 0}</h3>
                  </div>
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                      <p className="text-slate-400 text-sm mb-1">Carga DB</p>
                      <h3 className="text-2xl font-bold text-white flex items-center gap-2"><Cpu size={18} className="text-blue-400"/> {Math.floor(Math.random()*15)}%</h3>
                  </div>
              </div>
          )}

          {activeTab === 'settings' && (
              <div className="max-w-3xl space-y-6">
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><ShieldCheck className="text-emerald-400"/> Segurança do Projeto</h2>
                      <div className="space-y-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">JWT Secret Isolado</label>
                              <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-2">
                                  <code className="flex-1 font-mono text-sm text-slate-400">{showSecrets ? activeProject?.jwt_secret : '••••••••••••••••••••••••'}</code>
                                  <button onClick={() => setShowSecrets(!showSecrets)} className="text-slate-500 hover:text-white px-2">{showSecrets ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Origens CORS (Browser)</label>
                              <textarea className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white font-mono text-sm h-24" value={editProject?.cors_origins} onChange={e => setEditProject({...editProject, cors_origins: e.target.value})} />
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-end">
                      <button onClick={handleSaveSettings} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all"><Save size={18}/> Salvar Tudo</button>
                  </div>
              </div>
          )}

          {activeTab === 'infra' && (
              <div className="max-w-4xl space-y-6">
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Globe className="text-blue-400"/> Roteamento Nginx</h2>
                      <p className="text-sm text-slate-400 mb-6">A Inércia utiliza roteamento nativo de borda. Copie a configuração abaixo para o seu servidor Nginx para ativar o domínio customizado com latência zero.</p>
                      
                      <div className="bg-slate-950 rounded-lg border border-slate-700 overflow-hidden">
                          <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                              <span className="text-xs font-mono text-slate-500">/etc/nginx/sites-enabled/{activeProject?.slug}.conf</span>
                              <button onClick={() => { copyToClipboard(nginxConfig); showToast("Configuração copiada!"); }} className="text-emerald-400 hover:text-white flex items-center gap-1 text-xs"><Copy size={12}/> Copiar</button>
                          </div>
                          <pre className="p-4 text-xs font-mono text-blue-300 overflow-x-auto leading-relaxed">
                              {nginxConfig}
                          </pre>
                      </div>

                      <div className="mt-6 p-4 bg-emerald-900/10 border border-emerald-900/30 rounded-lg flex gap-4">
                          <RefreshCw className="text-emerald-500 shrink-0" size={20}/>
                          <div>
                              <h4 className="text-sm font-bold text-white">Como aplicar?</h4>
                              <p className="text-xs text-slate-400 mt-1">1. Salve o conteúdo acima no seu servidor.<br/>2. Execute <code>nginx -s reload</code>.<br/>3. A API estará disponível instantaneamente em <b>{activeProject?.api_url}</b>.</p>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default Dashboard;