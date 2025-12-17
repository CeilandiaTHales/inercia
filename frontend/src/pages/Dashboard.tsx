import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Activity, Server, Database, Lock, Plug, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Dashboard = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<any>({});
  const [showConnect, setShowConnect] = useState(false);
  const [config, setConfig] = useState<any>({});
  // Real History for Chart
  const [tpsHistory, setTpsHistory] = useState<number[]>(new Array(30).fill(0));

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

  const ConnectModal = () => (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3"><Plug className="text-emerald-400" /> {t.dashboard.connect}</h2>
                  <button onClick={() => setShowConnect(false)} className="text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
              </div>
              <div className="space-y-6">
                  <div className="bg-black/50 p-4 rounded-lg border border-slate-800">
                      <p className="text-emerald-400 text-xs font-bold uppercase mb-2 tracking-wider">JavaScript / TypeScript SDK</p>
                      <pre className="text-sm text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
{`import { createClient } from '@inercia/sdk';

// Using real endpoint from config
const inercia = createClient('${config.apiExternalUrl || 'loading...'}', 'YOUR_API_KEY');

// Get data from table 'products'
const { data, error } = await inercia
  .from('products')
  .select('*');`}
                      </pre>
                  </div>
                  <div className="bg-black/50 p-4 rounded-lg border border-slate-800">
                      <p className="text-blue-400 text-xs font-bold uppercase mb-2 tracking-wider">cURL / REST API</p>
                      <pre className="text-sm text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
{`curl -X GET '${config.apiExternalUrl || 'loading...'}/api/tables/public/products/data' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -H 'apikey: YOUR_API_KEY'`}
                      </pre>
                  </div>
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
        <button onClick={() => setShowConnect(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all hover:scale-105">
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