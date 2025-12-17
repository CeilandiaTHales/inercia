import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Zap, Play, Code } from 'lucide-react';

const RpcManager = () => {
  const [functions, setFunctions] = useState<any[]>([]);
  const [selectedFunc, setSelectedFunc] = useState<any>(null);
  const [params, setParams] = useState<string>('{}');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    api.get('/rpc').then(setFunctions).catch(console.error);
  }, []);

  const executeRpc = async () => {
    if (!selectedFunc) return;
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
        <div className="w-72 bg-slate-800 rounded-lg border border-slate-700 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-850">
                <h2 className="font-bold text-white flex items-center gap-2">
                    <Zap size={18} className="text-yellow-500" /> Functions
                </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {functions.map((f, i) => (
                    <button 
                        key={i}
                        onClick={() => { setSelectedFunc(f); setResult(null); setParams('{}'); }}
                        className={`w-full text-left px-3 py-2 rounded mb-1 text-sm flex flex-col ${selectedFunc?.name === f.name ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                    >
                        <span className="font-mono font-bold">{f.name}</span>
                        <span className="text-xs opacity-70">{f.schema}</span>
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 flex flex-col gap-4">
            {selectedFunc ? (
                <>
                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                        <h2 className="text-xl font-bold text-white mb-1">{selectedFunc.name}</h2>
                        <p className="text-slate-400 font-mono text-sm mb-4">Args: {selectedFunc.args}</p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-400 mb-2">Test Parameters (JSON)</label>
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
                            <Play size={18} /> Execute
                        </button>
                    </div>

                    <div className="flex-1 bg-slate-950 rounded-lg border border-slate-700 p-4 overflow-auto">
                        <h3 className="text-slate-500 text-xs uppercase font-bold mb-2">Result Output</h3>
                        <pre className="text-sm font-mono text-slate-300">
                            {result ? JSON.stringify(result, null, 2) : '// Execution result will appear here...'}
                        </pre>
                    </div>
                    
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                        <h3 className="text-slate-400 text-sm font-bold mb-2 flex items-center gap-2">
                            <Code size={16} /> API Usage Example
                        </h3>
                        <div className="bg-slate-950 p-3 rounded text-xs font-mono text-slate-400 select-all">
                            curl -X POST https://inercia.unibloom.shop/api/rpc/{selectedFunc.name} \<br/>
                            &nbsp;&nbsp;-H "Content-Type: application/json" \<br/>
                            &nbsp;&nbsp;-H "Authorization: Bearer YOUR_JWT" \<br/>
                            &nbsp;&nbsp;-d '{params}'
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                    Select a function to test or create new ones via SQL Editor.
                </div>
            )}
        </div>
    </div>
  );
};

export default RpcManager;