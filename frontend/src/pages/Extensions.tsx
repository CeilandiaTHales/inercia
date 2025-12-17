import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Blocks, CheckCircle, Download } from 'lucide-react';

interface Extension {
    name: string;
    description: string;
    installed: boolean;
}

const Extensions = () => {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExtensions();
  }, []);

  const loadExtensions = async () => {
    try {
        const data = await api.get('/extensions');
        setExtensions(data);
    } catch (e) {
        console.error(e);
    }
  };

  const toggleExtension = async (name: string, currentStatus: boolean) => {
    setLoading(true);
    try {
        await api.post('/extensions', { 
            name, 
            action: currentStatus ? 'uninstall' : 'install' 
        });
        await loadExtensions();
    } catch (e) {
        console.error(e);
        alert('Failed to change extension status');
    } finally {
        setLoading(false);
    }
  };

  const filtered = extensions.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                    <Blocks className="text-purple-500" /> PostgreSQL Extensions
                </h1>
                <p className="text-slate-400">Supercharge your database with geospatial, crypto, and vector capabilities.</p>
            </div>
            <input 
                type="text" 
                placeholder="Search extensions..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded p-2 text-white w-64 focus:border-purple-500 focus:outline-none"
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
            {filtered.map((ext) => (
                <div key={ext.name} className={`p-4 rounded-lg border ${ext.installed ? 'bg-slate-800 border-emerald-500/30' : 'bg-slate-900 border-slate-800'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-white">{ext.name}</h3>
                        {ext.installed ? (
                            <CheckCircle size={18} className="text-emerald-500" />
                        ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-600" />
                        )}
                    </div>
                    <p className="text-sm text-slate-500 mb-4 h-12 overflow-hidden text-ellipsis line-clamp-2">
                        {ext.description || 'No description available.'}
                    </p>
                    <button 
                        onClick={() => toggleExtension(ext.name, ext.installed)}
                        disabled={loading}
                        className={`w-full py-2 rounded text-sm font-medium transition-colors ${
                            ext.installed 
                            ? 'bg-slate-800 text-red-400 hover:bg-red-900/20 border border-slate-700' 
                            : 'bg-white text-slate-900 hover:bg-slate-200'
                        }`}
                    >
                        {ext.installed ? 'Uninstall' : 'Install'}
                    </button>
                </div>
            ))}
        </div>
    </div>
  );
};

export default Extensions;