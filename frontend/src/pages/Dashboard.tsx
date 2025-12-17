import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Activity, Server, Database, Lock, Plug, X, Copy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Dashboard = () => {
  const { t } = useLanguage();
  const [health, setHealth] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [showConnect, setShowConnect] = useState(false);
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    const fetchData = async () => {
        try {
            const healthRes = await api.get('/health');
            setHealth(healthRes);
            const tablesRes = await api.get('/tables');
            setTables(tablesRes);
            const configRes = await api.get('/config');
            setConfig(configRes);
        } catch (e) {
            console.error(e);
        }
    };
    fetchData();
  }, []);

  const ConnectModal = () => (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-lg max-w-2xl w-full p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2"><Plug /> {t.dashboard.connect}</h2>
                  <button onClick={() => setShowConnect(false)} className="text-slate-400 hover:text-white"><X /></button>
              </div>
              
              <div className="space-y-4">
                  <div className="bg-slate-900 p-4 rounded border border-slate-700">
                      <p className="text-slate-400 text-sm mb-2 font-bold uppercase">Javascript / React / Vue</p>
                      <pre className="text-xs text-emerald-400 font-mono overflow-x-auto p-2 bg-black rounded">
{`// Install the SDK (Simulated)
// npm install @inercia/sdk

import { createClient } from '@inercia/sdk';

const inercia = createClient('${config.apiExternalUrl}', 'YOUR_API_KEY');

const { data, error } = await inercia
  .from('products')
  .select('*');`}
                      </pre>
                  </div>

                  <div className="bg-slate-900 p-4 rounded border border-slate-700">
                      <p className="text-slate-400 text-sm mb-2 font-bold uppercase">CURL / REST API</p>
                      <pre className="text-xs text-blue-300 font-mono overflow-x-auto p-2 bg-black rounded">
{`curl -X GET '${config.apiExternalUrl}/api/tables/public/products/data' \\
  -H 'Authorization: Bearer YOUR_TOKEN'`}
                      </pre>
                  </div>
              </div>
              <div className="mt-6 flex justify-end">
                  <button onClick={() => setShowConnect(false)} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold">Done</button>
              </div>
          </div>
      </div>
  );

  return (
    <div className="space-y-6">
      {showConnect && <ConnectModal />}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">{t.dashboard.title}</h1>
        <div className="flex gap-2">
            <button onClick={() => setShowConnect(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2">
                <Plug size={18} /> {t.dashboard.connect}
            </button>
        </div>
      </div>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={64} className="text-emerald-500" /></div>
            <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-slate-400 font-medium">{t.dashboard.status}</h3>
                <Activity className="text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-white relative z-10">
                {health?.status === 'healthy' ? t.dashboard.operational : t.dashboard.offline}
            </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-medium">Database</h3>
                <Database className="text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-white">
                {health?.db === 'connected' ? t.dashboard.db_connected : 'Error'}
            </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-medium">{t.dashboard.tables}</h3>
                <Server className="text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-white">{tables.length}</div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-medium">{t.dashboard.security}</h3>
                <Lock className="text-yellow-500" />
            </div>
            <div className="text-2xl font-bold text-white">Active</div>
        </div>
      </div>

      {/* Analytics Charts (Visual Simulation) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">API Usage (Requests)</h2>
                <select className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                    <option>Last 24 Hours</option>
                    <option>Last 7 Days</option>
                </select>
            </div>
            <div className="h-48 flex items-end gap-2 justify-between px-2">
                {[45, 60, 30, 80, 55, 90, 70, 40, 65, 85, 50, 75, 95, 60, 40, 70, 50, 80, 60, 90, 100, 80, 60, 40].map((h, i) => (
                    <div key={i} className="bg-emerald-500/80 hover:bg-emerald-400 transition-all rounded-t w-full" style={{ height: `${h}%` }}></div>
                ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>00:00</span>
                <span>12:00</span>
                <span>23:59</span>
            </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
             <h2 className="text-xl font-bold text-white mb-6">Users Online</h2>
             <div className="h-48 flex items-center justify-center relative">
                 <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
                     <path d="M0 45 Q 10 30, 20 40 T 40 20 T 60 35 T 80 10 T 100 30" fill="none" stroke="#60a5fa" strokeWidth="2" />
                     <path d="M0 45 Q 10 30, 20 40 T 40 20 T 60 35 T 80 10 T 100 30 V 50 H 0 Z" fill="url(#grad)" opacity="0.2" />
                     <defs>
                        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
                            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
                        </linearGradient>
                     </defs>
                 </svg>
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                     <span className="text-4xl font-bold text-white">12</span>
                     <span className="block text-xs text-slate-400">Active Now</span>
                 </div>
             </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;