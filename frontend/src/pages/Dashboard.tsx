import React, { useEffect, useState } from 'react';
import { api, copyToClipboard } from '../api';
import { Activity, Server, Database, Lock, Plug, X, Copy, Eye, EyeOff, Key, Database as DbIcon, Radio } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Dashboard = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<any>({});
  const [showConnect, setShowConnect] = useState(false);
  const [config, setConfig] = useState<any>({});
  
  // Connection Info
  const [apiKeys, setApiKeys] = useState({ anon: '', service: '' });
  const [dbInfo, setDbInfo] = useState<any>(null);
  
  // Real History for Chart
  const [tpsHistory, setTpsHistory] = useState<number[]>(new Array(30).fill(0));

  // Connect Modal State
  const [connectTab, setConnectTab] = useState<'api' | 'postgres' | 'redis'>('api');
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    api.get('/config').then(setConfig).catch(console.error);
    
    const fetchStats = () => {
        api.get('/stats').then(newStats => {
            setStats(newStats);
            // Update History Real Data
            setTpsHistory(prev => {
                const currentLoad = parseInt(newStats.active_queries || '0') + (parseInt(newStats.active_connections || '0') / 5);
                const newHistory = [...prev.slice(1), currentLoad];
                return newHistory;
            });
        }).catch(console.error);
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Faster update for chart feeling
    return () => clearInterval(interval);
  }, []);

  const openConnectModal = async () => {
      setShowConnect(true);
      try {
          // Fetch Keys
          const k = await api.get('/auth/keys');
          setApiKeys(k);
          // Fetch Admin Connection Info
          const d = await api.get('/admin/connection-info');
          setDbInfo(d);
      } catch(e) { console.error(e); }
  };

  const handleCopy = (text: string) => {
      copyToClipboard(text).then(() => {
          // Could add a small toast here, but for now specific components handle it or just no-op visual feedback
      }).catch(e => alert("Erro ao copiar: " + e));
  };

  const SecretField = ({ label, value }: { label: string, value: string }) => (
      <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-2">
              <code className="flex-1 font-mono text-sm text-slate-300 truncate mr-2">
                  {showSecrets ? value : '•'.repeat(value.length > 20 ? 20 : value.length)}
              </code>
              <button onClick={() => handleCopy(value)} className="text-slate-500 hover:text-white"><Copy size={16}/></button>
          </div>
      </div>
  );

  const ConnectModal = () => (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                  <h2 className="text-xl font-bold text-white flex items-center gap-3"><Plug className="text-emerald-400" /> Detalhes de Conexão</h2>
                  <div className="flex items-center gap-4">
                      <button onClick={() => setShowSecrets(!showSecrets)} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm">
                          {showSecrets ? <EyeOff size={16}/> : <Eye size={16}/>} {showSecrets ? 'Ocultar' : 'Revelar'}
                      </button>
                      <button onClick={() => setShowConnect(false)} className="text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
                  </div>
              </div>
              
              <div className="flex border-b border-slate-800 bg-slate-900">
                  <button onClick={() => setConnectTab('api')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${connectTab === 'api' ? 'border-emerald-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}><Key size={16}/> API Keys</button>
                  <button onClick={() => setConnectTab('postgres')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${connectTab === 'postgres' ? 'border-blue-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}><DbIcon size={16}/> Postgres</button>
                  <button onClick={() => setConnectTab('redis')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${connectTab === 'redis' ? 'border-red-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}><Server size={16}/> Redis</button>
              </div>

              <div className="p-6 overflow-y-auto bg-slate-900">
                  {connectTab === 'api' && (
                      <div className="space-y-6">
                          <div>
                              <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-0.5 rounded bg-emerald-900 text-emerald-300 text-[10px] font-bold uppercase">Public</span>
                                  <label className="text-sm font-bold text-white">Anon Key</label>
                              </div>
                              <p className="text-xs text-slate-500 mb-2">Chave segura para usar no frontend (React, Apps, etc).</p>
                              <div className="flex bg-black border border-slate-800 rounded p-3">
                                  <code className="flex-1 font-mono text-xs text-emerald-400 break-all">
                                      {showSecrets ? apiKeys.anon : apiKeys.anon.substring(0, 10) + '...'}
                                  </code>
                                  <button onClick={() => handleCopy(apiKeys.anon)} className="ml-2 text-slate-500 hover:text-white"><Copy size={16}/></button>
                              </div>
                          </div>

                          <div>
                              <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-0.5 rounded bg-red-900 text-red-300 text-[10px] font-bold uppercase">Secret</span>
                                  <label className="text-sm font-bold text-white">Service Role Key</label>
                              </div>
                              <p className="text-xs text-slate-500 mb-2">Chave com privilégios de Admin. Use APENAS no servidor.</p>
                              <div className="flex bg-black border border-slate-800 rounded p-3">
                                  <code className="flex-1 font-mono text-xs text-red-400 break-all">
                                      {showSecrets ? apiKeys.service : apiKeys.service.substring(0, 10) + '...'}
                                  </code>
                                  <button onClick={() => handleCopy(apiKeys.service)} className="ml-2 text-slate-500 hover:text-white"><Copy size={16}/></button>
                              </div>
                          </div>
                      </div>
                  )}

                  {connectTab === 'postgres' && dbInfo && (
                      <div className="space-y-4">
                          <SecretField label="Connection String (URI)" value={dbInfo.database.url} />
                          <div className="grid grid-cols-2 gap-4">
                              <SecretField label="Host" value={dbInfo.database.host} />
                              <SecretField label="Port" value={dbInfo.database.port} />
                              <SecretField label="User" value={dbInfo.database.user} />
                              <SecretField label="Database" value={dbInfo.database.database} />
                              <SecretField label="Password" value={dbInfo.database.password} />
                          </div>
                      </div>
                  )}

                  {connectTab === 'redis' && dbInfo && (
                       <div className="space-y-4">
                           <SecretField label="Redis Connection String" value={dbInfo.redis.url} />
                           <div className="bg-slate-800 p-4 rounded text-xs text-slate-400">
                               O Redis é utilizado internamente para filas de tarefas (Workers) e Cache. Conecte-se para monitorar ou usar como cache rápido.
                           </div>
                       </div>
                  )}
              </div>
          </div>
      </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {showConnect && <ConnectModal />}
      
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-4xl font-bold text-white mb-2">{t.dashboard.title}</h1>
            <p className="text-slate-400">Monitoramento e status em tempo real.</p>
        </div>
        <button onClick={openConnectModal} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all hover:scale-105">
            <Plug size={20} /> {t.dashboard.connect}
        </button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">{t.dashboard.status}</p>
                    <h3 className="text-2xl font-bold text-white">{t.dashboard.operational}</h3>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500"><Activity size={24} /></div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online
            </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-colors">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">{t.dashboard.active_users}</p>
                    <h3 className="text-2xl font-bold text-white">{stats.user_count || 0}</h3>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500"><Server size={24} /></div>
            </div>
             <div className="mt-4 w-full bg-slate-700 h-1 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: '45%' }}></div>
             </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-purple-500/50 transition-colors">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">{t.dashboard.tables}</p>
                    <h3 className="text-2xl font-bold text-white">{stats.table_count || 0}</h3>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500"><Database size={24} /></div>
            </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-yellow-500/50 transition-colors">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">{t.dashboard.conn_usage}</p>
                    <h3 className="text-2xl font-bold text-white">{stats.active_connections || 0}</h3>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-500"><Lock size={24} /></div>
            </div>
            <p className="text-xs text-slate-500 mt-4">Postgres Connections</p>
        </div>
      </div>

      {/* Real Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-white mb-6">Carga do Banco (Histórico 2.5 min)</h3>
            <div className="h-64 flex items-end gap-1 border-b border-slate-700 pb-1">
                {tpsHistory.map((val, i) => {
                    // Normalize height (assuming max reasonable load for graph is 50 for visualization)
                    const height = Math.min(100, Math.max(5, val * 4)); 
                    return (
                        <div 
                            key={i} 
                            className="flex-1 bg-emerald-500/80 rounded-t hover:bg-emerald-400 transition-all duration-500 relative group" 
                            style={{ height: `${height}%` }}
                        >
                             <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-xs px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                 {val}
                             </div>
                        </div>
                    )
                })}
            </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col justify-center items-center">
             <h3 className="text-lg font-bold text-white mb-2 self-start">Conexões vs Limite</h3>
             <div className="relative w-48 h-48 mt-4">
                 <svg className="w-full h-full" viewBox="0 0 36 36">
                    <path className="text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path className="text-blue-500 transition-all duration-1000 ease-out" strokeDasharray={`${Math.min((stats.active_connections || 0), 100)}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                 </svg>
                 <div className="absolute inset-0 flex items-center justify-center flex-col">
                     <span className="text-3xl font-bold text-white">{stats.active_connections || 0}</span>
                     <span className="text-xs text-slate-400">/ {stats.active_connections > 90 ? '!!' : '100'}</span>
                 </div>
             </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;