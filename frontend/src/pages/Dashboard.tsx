import React, { useEffect, useState } from 'react';
import { api, copyToClipboard } from '../api';
import { Activity, Server, Database, Lock, Plug, X, Copy, Eye, EyeOff, Key, Database as DbIcon, Radio, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

const Dashboard = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [stats, setStats] = useState<any>({});
  const [showConnect, setShowConnect] = useState(false);
  const [config, setConfig] = useState<any>({});
  
  const [apiKeys, setApiKeys] = useState({ anon: '', service: '' });
  const [dbInfo, setDbInfo] = useState<any>(null);
  const [tpsHistory, setTpsHistory] = useState<number[]>(new Array(30).fill(0));
  const [connectTab, setConnectTab] = useState<'api' | 'postgres' | 'redis'>('api');
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    api.get('/config').then(setConfig).catch(console.error);
    const fetchStats = () => {
        api.get('/stats').then(newStats => {
            setStats(newStats);
            setTpsHistory(prev => [...prev.slice(1), parseInt(newStats.active_queries || '0')]);
        }).catch(console.error);
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const openConnectModal = async () => {
      setShowSecrets(false); // Reset reveal on open
      setShowConnect(true);
      try {
          const [k, d] = await Promise.all([api.get('/auth/keys'), api.get('/admin/connection-info')]);
          setApiKeys(k);
          setDbInfo(d);
      } catch(e) { console.error(e); }
  };

  const handleCopy = (text: string) => {
      copyToClipboard(text).then(() => showToast("Copiado!")).catch(e => showToast("Erro ao copiar", 'error'));
  };

  const SecretField = ({ label, value, help }: { label: string, value: string, help?: string }) => (
      <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-bold text-slate-500 uppercase">{label}</label>
            {help && <span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-1 rounded">{help}</span>}
          </div>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-2">
              <code className="flex-1 font-mono text-sm text-slate-300 truncate mr-2">
                  {showSecrets ? value : '••••••••••••••••••••••••'}
              </code>
              <button onClick={() => handleCopy(value)} className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-slate-800"><Copy size={16}/></button>
          </div>
      </div>
  );

  const ConnectModal = () => (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                  <h2 className="text-xl font-bold text-white flex items-center gap-3"><Plug className="text-emerald-400" /> Conexão</h2>
                  <div className="flex items-center gap-4">
                      <button onClick={() => setShowSecrets(!showSecrets)} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm px-3 py-1 rounded bg-slate-800 border border-slate-700">
                          {showSecrets ? <EyeOff size={16}/> : <Eye size={16}/>} {showSecrets ? 'Esconder' : 'Revelar'}
                      </button>
                      <button onClick={() => setShowConnect(false)} className="text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
                  </div>
              </div>
              
              <div className="flex border-b border-slate-800 bg-slate-900">
                  {['api', 'postgres', 'redis'].map((t: any) => (
                      <button key={t} onClick={() => setConnectTab(t)} className={`flex-1 py-3 text-sm font-bold capitalize border-b-2 transition-colors ${connectTab === t ? 'border-emerald-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:bg-slate-800'}`}>{t}</button>
                  ))}
              </div>

              <div className="p-6 overflow-y-auto bg-slate-900">
                  {connectTab === 'api' && (
                      <div className="space-y-6">
                          <SecretField label="REST API URL" value={dbInfo?.apiUrl || ''} />
                          <SecretField label="Anon Key (Public)" value={apiKeys.anon} />
                          <SecretField label="Service Role Key (Secret)" value={apiKeys.service} />
                      </div>
                  )}
                  {connectTab === 'postgres' && dbInfo && (
                      <div className="space-y-4">
                          <SecretField label="Postgres Connection URI" value={dbInfo.database.url} />
                      </div>
                  )}
                  {connectTab === 'redis' && dbInfo && (
                       <div className="space-y-4">
                           <SecretField label="Redis Connection String" value={dbInfo.redis.url} />
                           <SecretField label="Redis Password" value={dbInfo.redis.password || 'Sem Senha'} />
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
        <div><h1 className="text-4xl font-bold text-white mb-2">{t.dashboard.title}</h1><p className="text-slate-400">Infraestrutura em tempo real.</p></div>
        <button onClick={openConnectModal} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all"><Plug size={20} /> {t.dashboard.connect}</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><p className="text-slate-400 text-sm mb-1">{t.dashboard.status}</p><h3 className="text-2xl font-bold text-white flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span> {t.dashboard.operational}</h3></div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><p className="text-slate-400 text-sm mb-1">Usuários</p><h3 className="text-2xl font-bold text-white">{stats.user_count || 0}</h3></div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><p className="text-slate-400 text-sm mb-1">Tabelas</p><h3 className="text-2xl font-bold text-white">{stats.table_count || 0}</h3></div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><p className="text-slate-400 text-sm mb-1">Conexões</p><h3 className="text-2xl font-bold text-white">{stats.active_connections || 0}</h3></div>
      </div>
    </div>
  );
};

export default Dashboard;