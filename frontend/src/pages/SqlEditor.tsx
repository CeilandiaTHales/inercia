import React, { useState } from 'react';
import { api } from '../api';
import { Play } from 'lucide-react';

const SqlEditor = () => {
  const [query, setQuery] = useState('SELECT * FROM auth.users;');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runQuery = async () => {
    setError(null);
    setResult(null);
    try {
        const res = await api.post('/sql', { query });
        if (res.error) throw new Error(res.error);
        setResult(res);
    } catch (e: any) {
        setError(e.message || 'An error occurred');
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">SQL Editor</h1>
            <button 
                onClick={runQuery}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded shadow-lg transition-all"
            >
                <Play size={16} fill="currentColor" />
                Run Query
            </button>
        </div>

        <div className="flex-1 grid grid-rows-2 gap-4 h-full">
            {/* Editor Area */}
            <div className="bg-slate-950 rounded-lg border border-slate-700 p-4 font-mono">
                <textarea 
                    className="w-full h-full bg-transparent text-slate-300 focus:outline-none resize-none"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    spellCheck="false"
                />
            </div>

            {/* Results Area */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
                <div className="bg-slate-850 p-2 border-b border-slate-700 text-xs text-slate-400 font-mono">
                    Results Output
                </div>
                <div className="flex-1 overflow-auto p-4">
                    {error && (
                        <div className="text-red-400 font-mono bg-red-900/20 p-4 rounded border border-red-900">
                            Error: {error}
                        </div>
                    )}
                    {result && (
                        <div className="space-y-2">
                             <div className="text-xs text-emerald-400 mb-2">
                                {result.command} completed. {result.rowCount} rows affected.
                             </div>
                             {result.rows && result.rows.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-900">
                                            <tr>
                                                {Object.keys(result.rows[0]).map(key => (
                                                    <th key={key} className="p-2 text-xs font-mono text-slate-400 border border-slate-700">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.rows.map((row: any, i: number) => (
                                                <tr key={i}>
                                                    {Object.values(row).map((val: any, j) => (
                                                        <td key={j} className="p-2 text-xs font-mono text-slate-300 border border-slate-700 whitespace-nowrap">
                                                            {val === null ? <span className="text-slate-600">NULL</span> : String(val)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                             )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default SqlEditor;
