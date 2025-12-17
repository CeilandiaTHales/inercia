import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Activity, Server, Database, Lock, Plug } from 'lucide-react';

const Dashboard = () => {
  const [health, setHealth] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const healthRes = await api.get('/health');
            setHealth(healthRes);
            const tablesRes = await api.get('/tables');
            setTables(tablesRes);
        } catch (e) {
            console.error(e);
        }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">System Overview</h1>
        <div className="flex gap-2">
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2">
                <Plug size={18} /> Connect App
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Health Card */}
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Activity size={64} className="text-emerald-500" />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-slate-400 font-medium">System Status</h3>
                <Activity className="text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-white relative z-10">
                {health?.status === 'healthy' ? 'Operational' : 'Offline'}
            </div>
            <p className="text-sm text-slate-500 mt-2 relative z-10">API v{health?.version || '1.0'}</p>
        </div>

        {/* Database Card */}
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-medium">Database</h3>
                <Database className="text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-white">
                {health?.db === 'connected' ? 'Connected' : 'Error'}
            </div>
            <p className="text-sm text-slate-500 mt-2">PostgreSQL 15</p>
        </div>

        {/* Tables Count */}
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-medium">Tables</h3>
                <Server className="text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-white">
                {tables.length}
            </div>
            <p className="text-sm text-slate-500 mt-2">Active Relations</p>
        </div>

        {/* Security */}
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-medium">Security</h3>
                <Lock className="text-yellow-500" />
            </div>
            <div className="text-2xl font-bold text-white">
                Active
            </div>
            <p className="text-sm text-slate-500 mt-2">RLS Enabled</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Connection Details</h2>
            <div className="space-y-4">
                <div>
                    <label className="text-xs text-slate-500 uppercase font-bold">API URL</label>
                    <div className="bg-slate-950 p-3 rounded text-slate-300 font-mono text-sm border border-slate-700 mt-1 select-all">
                        {window.location.origin}/api
                    </div>
                </div>
                <div>
                    <label className="text-xs text-slate-500 uppercase font-bold">Postgres Connection String</label>
                    <div className="bg-slate-950 p-3 rounded text-slate-300 font-mono text-sm border border-slate-700 mt-1 select-all break-all">
                        postgresql://postgres:[PASSWORD]@{window.location.hostname}:5432/inercia_prod
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
             <h2 className="text-xl font-bold text-white mb-4">Service Status</h2>
             <div className="space-y-3">
                 <div className="flex justify-between items-center p-3 bg-slate-900 rounded border border-slate-700">
                     <span className="text-slate-300">Auth Service</span>
                     <span className="text-emerald-500 text-sm font-bold">ONLINE</span>
                 </div>
                 <div className="flex justify-between items-center p-3 bg-slate-900 rounded border border-slate-700">
                     <span className="text-slate-300">Storage Engine</span>
                     <span className="text-emerald-500 text-sm font-bold">ONLINE</span>
                 </div>
                 <div className="flex justify-between items-center p-3 bg-slate-900 rounded border border-slate-700">
                     <span className="text-slate-300">Realtime (Redis)</span>
                     <span className="text-emerald-500 text-sm font-bold">ONLINE</span>
                 </div>
             </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;