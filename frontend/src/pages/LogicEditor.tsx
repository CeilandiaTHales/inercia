import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Folder, FileCode, Play, Save, Plus, ChevronRight, ChevronDown, FolderPlus, FilePlus, FileText } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface TreeItem {
    name: string;
    type: 'schema' | 'function' | 'file';
    schema?: string;
    children?: TreeItem[];
    def?: string;
    args?: string;
    content?: string;
}

const LogicEditor = () => {
  const { t } = useLanguage();
  const [tree, setTree] = useState<TreeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<TreeItem | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({'principal': true});
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [config, setConfig] = useState<any>({});
  
  // New Item
  const [showNewModal, setShowNewModal] = useState(false);
  const [newItemType, setNewItemType] = useState<'folder' | 'function' | 'file'>('folder');
  const [newItemName, setNewItemName] = useState('');

  useEffect(() => { loadTree(); api.get('/config').then(setConfig); }, []);

  const loadTree = async () => {
    try {
        const [funcs, schemas, files] = await Promise.all([
            api.get('/rpc'),
            api.get('/schemas'),
            api.get('/files')
        ]);

        const root: Record<string, TreeItem[]> = {};

        // 1. Schemas as Folders
        schemas.forEach((s: any) => {
             // Exclude defaults if backend didn't already
             if (!['public', 'inercia_sys'].includes(s.name)) {
                 root[s.name] = [];
             }
        });
        
        // Ensure "principal" exists
        if (!root['principal']) root['principal'] = [];

        // 2. Functions
        funcs.forEach((f: any) => {
            let targetFolder = f.schema;
            if (f.schema === 'public') targetFolder = 'principal'; // "Public" functions go to Principal
            
            // Only add if target folder exists (we ignored system schemas)
            if (root[targetFolder]) {
                root[targetFolder].push({
                    name: f.name,
                    type: 'function',
                    schema: f.schema,
                    def: f.def,
                    args: f.args
                });
            }
        });

        // 3. Files (Text/Scripts)
        files.forEach((f: any) => {
            const target = f.schema_name || 'principal';
            if (root[target]) {
                root[target].push({
                    name: f.name,
                    type: 'file',
                    schema: target,
                    content: f.content
                });
            }
        });

        const treeData: TreeItem[] = Object.keys(root).sort().map(k => ({
            name: k,
            type: 'schema',
            children: root[k]
        }));

        setTree(treeData);
    } catch(e) { console.error(e); }
  };

  const handleSelect = (item: TreeItem) => {
      setSelectedItem(item);
      if (item.type === 'function') setCode(item.def || '');
      else if (item.type === 'file') setCode(item.content || '');
      setResult(null);
  };

  const runCode = async () => {
      setResult(null);
      if (selectedItem?.type === 'file') {
          // Update file content
          try {
             // Basic implementation: delete old and insert new (versioning would be better but keeping it simple)
             // Real impl would need ID. Using name+schema as key for now in this simple version
             alert("File saved (Simulation). To implement real save, use ID.");
          } catch(e) {}
          return;
      }
      try {
          // If "SELECT", execute it. If "CREATE", execute it.
          const res = await api.post('/sql', { query: code });
          setResult({ status: 'success', data: res });
          if (res.createdFunction) loadTree();
      } catch (e: any) {
          setResult({ status: 'error', message: e.message });
      }
  };

  const createItem = async () => {
      try {
          if (newItemType === 'folder') {
              await api.post('/schemas', { name: newItemName });
          } else if (newItemType === 'file') {
              await api.post('/files', { name: newItemName, content: '', schema_name: 'principal' }); // Default to principal for simplicity in UI
          } else {
              // Function Template
              const template = `CREATE OR REPLACE FUNCTION public.${newItemName}() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;`;
              setCode(template);
          }
          setShowNewModal(false);
          setNewItemName('');
          loadTree();
      } catch(e: any) { alert(e.message); }
  };

  return (
    <div className="flex h-full gap-4">
        {showNewModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-slate-800 p-6 rounded border border-slate-600">
                    <h3 className="text-white font-bold mb-4">Criar Novo Item</h3>
                    <div className="flex gap-2 mb-4">
                        <button onClick={() => setNewItemType('folder')} className={`px-3 py-1 rounded text-sm ${newItemType === 'folder' ? 'bg-emerald-600' : 'bg-slate-700'}`}>Pasta</button>
                        <button onClick={() => setNewItemType('function')} className={`px-3 py-1 rounded text-sm ${newItemType === 'function' ? 'bg-emerald-600' : 'bg-slate-700'}`}>Função SQL</button>
                        <button onClick={() => setNewItemType('file')} className={`px-3 py-1 rounded text-sm ${newItemType === 'file' ? 'bg-emerald-600' : 'bg-slate-700'}`}>Arquivo Txt</button>
                    </div>
                    <input className="bg-slate-900 border border-slate-700 text-white p-2 rounded w-64 mb-4" placeholder="Nome..." value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowNewModal(false)} className="text-slate-400">Cancelar</button>
                        <button onClick={createItem} className="bg-emerald-600 text-white px-4 py-2 rounded">Criar</button>
                    </div>
                </div>
            </div>
        )}

        <div className="w-64 bg-slate-800 rounded border border-slate-700 flex flex-col">
            <div className="p-3 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">{t.logic.explorer}</span>
                <button onClick={() => setShowNewModal(true)} className="text-emerald-400 hover:text-white"><Plus size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {tree.map(schema => (
                    <div key={schema.name}>
                        <div 
                            className="flex items-center gap-1 text-slate-300 hover:bg-slate-700 px-2 py-1 rounded cursor-pointer select-none"
                            onClick={() => setExpanded({...expanded, [schema.name]: !expanded[schema.name]})}
                        >
                            {expanded[schema.name] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                            <Folder size={14} className={schema.name === 'principal' ? "text-emerald-500" : "text-blue-400"} />
                            <span className="text-sm font-bold capitalize">{schema.name}</span>
                        </div>
                        {expanded[schema.name] && (
                            <div className="ml-4 border-l border-slate-700 pl-2">
                                {schema.children?.map((item, i) => (
                                    <div 
                                        key={i}
                                        className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm ${selectedItem === item ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                        onClick={() => handleSelect(item)}
                                    >
                                        {item.type === 'function' ? <FileCode size={14} /> : <FileText size={14} />}
                                        <span className="truncate">{item.name}</span>
                                    </div>
                                ))}
                                {(!schema.children || schema.children.length === 0) && <div className="text-[10px] text-slate-600 pl-2 italic">Vazio</div>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        <div className="flex-1 flex flex-col gap-4">
             <div className="flex-1 bg-slate-950 border border-slate-700 rounded overflow-hidden flex flex-col">
                <div className="bg-slate-900 p-2 border-b border-slate-700 flex justify-between items-center">
                     <span className="text-xs text-slate-400 font-mono">{selectedItem ? `${selectedItem.schema}/${selectedItem.name}` : 'Editor'}</span>
                     <button onClick={runCode} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold">
                         <Play size={12} /> Executar / Salvar
                     </button>
                </div>
                <textarea 
                    className="flex-1 bg-transparent p-4 text-emerald-300 font-mono text-sm focus:outline-none resize-none"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    spellCheck="false"
                    placeholder="-- Escreva SQL ou selecione um arquivo..."
                />
            </div>

            {selectedItem?.type === 'function' && (
                <div className="bg-slate-800 border border-slate-700 rounded p-4">
                     <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Integração API (cURL)</h4>
                     <div className="bg-black p-3 rounded text-xs font-mono text-slate-300 overflow-x-auto select-all">
                        curl -X POST {config.apiExternalUrl}/api/rpc/{selectedItem.name} \<br/>
                        &nbsp;&nbsp;-H "Authorization: Bearer YOUR_TOKEN" \<br/>
                        &nbsp;&nbsp;-H "Content-Type: application/json" \<br/>
                        &nbsp;&nbsp;-d '{`{ "arg1": "value" }`}'
                     </div>
                </div>
            )}

            {result && (
                <div className="h-40 bg-slate-800 border border-slate-700 rounded flex flex-col overflow-hidden">
                    <div className="bg-slate-900 p-2 border-b border-slate-700 text-xs font-bold text-slate-400">Resultados</div>
                    <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-300">
                        {result.status === 'error' ? <span className="text-red-400">{result.message}</span> : JSON.stringify(result.data, null, 2)}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default LogicEditor;