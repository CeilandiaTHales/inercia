import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Activity, Server, Database, Lock } from 'lucide-react';

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
      <h1 className="text-3xl font-bold text-white mb-8">System Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Health Card */}
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-medium">System Status</h3>
                <Activity className="text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-white">
                {health?.status === 'healthy' ? 'Operational' : 'Offline'}
            </div>
            <p className="text-sm text-slate-500 mt-2">API Latency: 24ms</p>
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

      <div className="mt-8 bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Quick Start</h2>
        <div className="bg-slate-950 p-4 rounded text-slate-300 font-mono text-sm">
            <p className="mb-2"># Install JS Client</p>
            <p className="text-emerald-400">npm install @inercia/js</p>
            <br />
            <p className="mb-2"># Initialize</p>
            <p className="text-blue-400">import &#123; createClient &#125; from '@inercia/js'</p>
            <p>const inercia = createClient('http://your-vps-ip:8080', 'YOUR_API_KEY')</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
