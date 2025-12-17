import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Folder, FileCode, Play, Save, Plus, ChevronRight, ChevronDown, FolderPlus, FilePlus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface TreeItem {
    name: string;
    type: 'schema' | 'function';
    schema?: string;
    children?: TreeItem[];
    def?: string;
    args?: string;
}

const LogicEditor = () => {
  const { t } = useLanguage();
  const [tree, setTree] = useState<TreeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<TreeItem | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({'public': true});
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  
  // New Item State
  const [showNewModal, setShowNewModal] = useState<'schema' | 'function' | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    try {
        const funcs = await api.get('/rpc'); // Returns {schema, name, args, def}
        
        // Group by schema
        const schemaMap: Record<string, TreeItem[]> = {};
        
        funcs.forEach((f: any) => {
            if (!schemaMap[f.schema]) schemaMap[f.schema] = [];
            schemaMap[f.schema].push({
                name: f.name,
                type: 'function',
                schema: f.schema,
                def: f.def,
                args: f.args
            });
        });

        const treeData: TreeItem[] = Object.keys(schemaMap).sort().map(s => ({
            name: s,
            type: 'schema',
            children: schemaMap[s]
        }));
        
        // Ensure standard schemas exist in tree even if empty of functions
        if (!schemaMap['public']) treeData.unshift({ name: 'public', type: 'schema', children: [] });

        setTree(treeData);
    } catch(e) { console.error(e); }
  };

  const handleSelect = (item: TreeItem) => {
      if (item.type === 'function') {
          setSelectedItem(item);
          setCode(item.def || '');
          setResult(null);
      } else {
          toggleExpand(item.name);
      }
  };

  const toggleExpand = (name: string) => {
      setExpanded(prev => ({...prev, [name]: !prev[name]}));
  };

  const runCode = async () => {
      setResult(null);
      try {
          // Identify if it's a SELECT/Execute or a Definition
          const isCall = !/CREATE\s+OR\s+REPLACE\s+FUNCTION/i.test(code);
          
          if (isCall && selectedItem && selectedItem.type === 'function' && !code.trim().toUpperCase().startsWith('SELECT')) {
             // It's likely just JSON params for RPC testing
             try {
                const params = JSON.parse(code);
                const res = await api.post(`/rpc/${selectedItem.name}`, params);
                setResult({ status: 'success', data: res });
             } catch (jsonErr) {
                 // Fallback to SQL execution
                 const res = await api.post('/sql', { query: code });
                 setResult({ status: 'success', data: res });
             }
          } else {
             // Standard SQL execution
             const res = await api.post('/sql', { query: code });
             setResult({ status: 'success', data: res });
             if (res.createdFunction) loadTree();
          }
      } catch (e: any) {
          setResult({ status: 'error', message: e.message });
      }
  };

  const createItem = async () => {
      try {
          if (showNewModal === 'schema') {
              await api.post('/schemas', { name: newName });
          } else {
              // Creating a function template
              const template = `CREATE OR REPLACE FUNCTION public.${newName}()
RETURNS void AS $$
BEGIN
  -- Your logic here
END;
$$ LANGUAGE plpgsql;`;
              setCode(template);
              setSelectedItem({ name: newName, type: 'function', schema: 'public' }); // Temporary visual
          }
          setShowNewModal(null);
          setNewName('');
          loadTree();
      } catch (e: any) {
          alert(e.message);
      }
  };

  return (
    <div className="flex h-full gap-4">
        {/* Modal */}
        {showNewModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-slate-800 p-6 rounded border border-slate-600">
                    <h3 className="text-white font-bold mb-4">New {showNewModal}</h3>
                    <input className="bg-slate-900 border border-slate-700 text-white p-2 rounded w-64" placeholder="Name..." value={newName} onChange={e => setNewName(e.target.value)} />
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setShowNewModal(null)} className="text-slate-400">Cancel</button>
                        <button onClick={createItem} className="bg-emerald-600 text-white px-4 py-2 rounded">Create</button>
                    </div>
                </div>
            </div>
        )}

        {/* Sidebar File Tree */}
        <div className="w-64 bg-slate-800 rounded border border-slate-700 flex flex-col">
            <div className="p-3 bg-slate-850 border-b border-slate-700 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Explorer</span>
                <div className="flex gap-1">
                    <button onClick={() => setShowNewModal('schema')} className="text-slate-400 hover:text-white" title="New Schema"><FolderPlus size={14}/></button>
                    <button onClick={() => setShowNewModal('function')} className="text-slate-400 hover:text-white" title="New Function"><FilePlus size={14}/></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {tree.map(schema => (
                    <div key={schema.name}>
                        <div 
                            className="flex items-center gap-1 text-slate-300 hover:bg-slate-700 px-2 py-1 rounded cursor-pointer"
                            onClick={() => toggleExpand(schema.name)}
                        >
                            {expanded[schema.name] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                            <Folder size={14} className="text-blue-400" />
                            <span className="text-sm font-bold">{schema.name}</span>
                        </div>
                        {expanded[schema.name] && (
                            <div className="ml-4 border-l border-slate-700 pl-2">
                                {schema.children?.map(func => (
                                    <div 
                                        key={func.name}
                                        className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm ${selectedItem?.name === func.name ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                        onClick={() => handleSelect(func)}
                                    >
                                        <FileCode size={14} />
                                        <span>{func.name}</span>
                                    </div>
                                ))}
                                {(!schema.children || schema.children.length === 0) && (
                                    <div className="text-[10px] text-slate-600 pl-2 italic">Empty</div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* Editor Pane */}
        <div className="flex-1 flex flex-col gap-4">
            <div className="flex-1 bg-slate-950 border border-slate-700 rounded overflow-hidden flex flex-col">
                <div className="bg-slate-900 p-2 border-b border-slate-700 flex justify-between items-center">
                     <span className="text-xs text-slate-400 font-mono">{selectedItem ? `${selectedItem.schema}/${selectedItem.name}` : 'New Query'}</span>
                     <button onClick={runCode} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold">
                         <Play size={12} /> Run / Save
                     </button>
                </div>
                <textarea 
                    className="flex-1 bg-transparent p-4 text-emerald-300 font-mono text-sm focus:outline-none resize-none"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    spellCheck="false"
                    placeholder="-- Select a function or write SQL..."
                />
            </div>

            {/* Results Pane */}
            <div className="h-1/3 bg-slate-800 border border-slate-700 rounded flex flex-col overflow-hidden">
                <div className="bg-slate-850 p-2 border-b border-slate-700 text-xs font-bold text-slate-400">Results</div>
                <div className="flex-1 p-4 overflow-auto font-mono text-xs">
                    {result?.status === 'error' && (
                        <div className="text-red-400">{result.message}</div>
                    )}
                    {result?.status === 'success' && (
                        <pre className="text-slate-300">
                            {JSON.stringify(result.data, null, 2)}
                        </pre>
                    )}
                    {!result && <div className="text-slate-600 italic">Ready to execute...</div>}
                </div>
            </div>
        </div>
    </div>
  );
};

export default LogicEditor;