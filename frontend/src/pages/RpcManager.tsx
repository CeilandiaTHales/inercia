import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Zap, Play, Code, Folder, FolderOpen, ChevronRight, ChevronDown, Plus, FolderPlus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const RpcManager = () => {
  const { t } = useLanguage();
  const [functions, setFunctions] = useState<any[]>([]);
  const [selectedFunc, setSelectedFunc] = useState<any>(null);
  const [params, setParams] = useState<string>('{}');
  const [result, setResult] = useState<any>(null);
  const [groupedFuncs, setGroupedFuncs] = useState<Record<string, any[]>>({});
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ 'public': true, 'default': false });
  const [externalUrl, setExternalUrl] = useState('http://localhost:3000');
  
  // New Schema State
  const [showNewSchema, setShowNewSchema] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState('');

  useEffect(() => {
    loadData();
    api.get('/config').then(c => {
        if (c.apiExternalUrl) setExternalUrl(c.apiExternalUrl);
    }).catch(console.error);
  }, []);

  const loadData = () => {
      api.get('/rpc').then(data => {
        setFunctions(data);
        groupFunctions(data);
    }).catch(console.error);
  }

  const groupFunctions = (data: any[]) => {
      const groups: Record<string, any[]> = { 'default': [], 'public': [] };
      
      data.forEach(f => {
          if (['pg_catalog', 'information_schema'].includes(f.schema) || f.name.startsWith('pg_') || f.name.startsWith('uuid_')) {
              groups['default'].push(f);
          } else if (f.schema === 'public') {
              groups['public'].push(f);
          } else {
              if (!groups[f.schema]) groups[f.schema] = [];
              groups[f.schema].push(f);
          }
      });
      setGroupedFuncs(groups);
  };

  const toggleFolder = (folder: string) => {
      setOpenFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const createSchema = async () => {
      if(!newSchemaName) return;
      try {
          await api.post('/schemas', { name: newSchemaName });
          setNewSchemaName('');
          setShowNewSchema(false);
          loadData(); // Reload to potentially show new schema if it had funcs, though usually empty initially
          alert("Schema created. Add functions to it via SQL Editor.");
      } catch (e: any) {
          alert("Error: " + e.message);
      }
  };

  const executeRpc = async () => {
    if (!selectedFunc) return;
    setResult(null);
    try {
        const parsedParams = JSON.parse(params);
        const res = await api.post(`/rpc/${selectedFunc.name}`, parsedParams);
        setResult(res);
    } catch (e: any) {
        setResult({ error: e.message || 'Execution failed' });
    }
  };

  return (
    <div className="h-full flex gap-6">
        {/* Sidebar Folders */}
        <div className="w-72 flex-shrink-0 bg-slate-800 rounded-lg border border-slate-700 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-850 flex justify-between items-center">
                <h2 className="font-bold text-white flex items-center gap-2">
                    <Zap size={18} className="text-yellow-500" /> {t.rpc.functions}
                </h2>
                <button 
                    onClick={() => setShowNewSchema(!showNewSchema)}
                    className="text-slate-400 hover:text-emerald-400" 
                    title={t.rpc.create_folder}
                >
                    <FolderPlus size={18} />
                </button>
            </div>
            
            {showNewSchema && (
                <div className="p-2 bg-slate-900 border-b border-slate-700">
                    <input 
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white mb-2" 
                        placeholder={t.rpc.folder_name}
                        value={newSchemaName}
                        onChange={e => setNewSchemaName(e.target.value)}
                    />
                    <button onClick={createSchema} className="w-full bg-emerald-600 text-white text-xs py-1 rounded">Create</button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {Object.keys(groupedFuncs).sort().map(folder => (
                    <div key={folder}>
                        <button 
                            onClick={() => toggleFolder(folder)}
                            className="w-full flex items-center gap-2 px-2 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        >
                            {openFolders[folder] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            {openFolders[folder] ? <FolderOpen size={16} className="text-emerald-500" /> : <Folder size={16} className="text-slate-500" />}
                            <span className="font-medium text-sm capitalize">{folder}</span>
                            <span className="ml-auto text-xs text-slate-600">{groupedFuncs[folder].length}</span>
                        </button>
                        
                        {openFolders[folder] && (
                            <div className="pl-6 mt-1 space-y-1 border-l border-slate-700 ml-4">
                                {groupedFuncs[folder].map((f, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => { setSelectedFunc(f); setResult(null); setParams('{}'); }}
                                        className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono truncate transition-colors ${selectedFunc?.name === f.name ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-emerald-300'}`}
                                        title={f.name}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                                {groupedFuncs[folder].length === 0 && <div className="text-xs text-slate-600 pl-2 italic">Empty</div>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* Execution Area */}
        <div className="flex-1 flex flex-col gap-4">
            {selectedFunc ? (
                <>
                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                             <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-400">{selectedFunc.schema}</span>
                             <h2 className="text-xl font-bold text-white">{selectedFunc.name}</h2>
                        </div>
                        <p className="text-slate-400 font-mono text-sm mb-4 bg-slate-900/50 p-2 rounded border border-slate-700/50">
                            args: {selectedFunc.args || '()'}
                        </p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-400 mb-2">{t.rpc.test_params}</label>
                            <textarea 
                                value={params}
                                onChange={e => setParams(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-600 rounded p-3 font-mono text-sm text-emerald-400 h-32 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <button 
                            onClick={executeRpc}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded flex items-center gap-2"
                        >
                            <Play size={18} /> {t.rpc.execute}
                        </button>
                    </div>

                    <div className="flex-1 bg-slate-950 rounded-lg border border-slate-700 p-4 overflow-auto flex flex-col">
                        <h3 className="text-slate-500 text-xs uppercase font-bold mb-2">{t.rpc.result}</h3>
                        <pre className="text-sm font-mono text-slate-300 flex-1">
                            {result ? JSON.stringify(result, null, 2) : '// Execution result...'}
                        </pre>
                    </div>
                    
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                        <h3 className="text-slate-400 text-sm font-bold mb-2 flex items-center gap-2">
                            <Code size={16} /> {t.rpc.usage}
                        </h3>
                        <div className="bg-slate-950 p-3 rounded text-xs font-mono text-slate-400 select-all overflow-x-auto whitespace-nowrap">
                            curl -X POST {externalUrl}/api/rpc/{selectedFunc.name} \<br/>
                            &nbsp;&nbsp;-H "Content-Type: application/json" \<br/>
                            &nbsp;&nbsp;-H "Authorization: Bearer YOUR_JWT" \<br/>
                            &nbsp;&nbsp;-d '{params}'
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">
                    <Zap size={48} className="mb-4 opacity-50" />
                    <p>{t.rpc.select_func}</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default RpcManager;