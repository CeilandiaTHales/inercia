import React, { useEffect, useState } from 'react';
import { api, copyToClipboard } from '../api';
import { Folder, FileCode, Play, Plus, ChevronRight, ChevronDown, FolderPlus, FileText, Trash2, Edit2, Save, Search, Zap, ArrowRight, Eye, EyeOff, Copy, Terminal, CheckCircle, CopyIcon, Files } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

interface TreeItem {
    id?: string;
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
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'code' | 'triggers'>('code');

  const [tree, setTree] = useState<TreeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<TreeItem | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [code, setCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [apiKeys, setApiKeys] = useState({ anon: '', service: '' });
  const [config, setConfig] = useState<any>({});
  
  const [testParams, setTestParams] = useState('{}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  
  const [triggers, setTriggers] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [funcsList, setFuncsList] = useState<any[]>([]);
  
  const [modalType, setModalType] = useState<'createFolder' | 'createItem' | 'rename' | 'createTrigger' | 'overwrite' | null>(null);
  const [overwritePayload, setOverwritePayload] = useState<{name: string, schema: string, sql: string} | null>(null);
  const [targetSchema, setTargetSchema] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState<'function' | 'file'>('function');
  const [contextMenu, setContextMenu] = useState<{x:number, y:number, target: any, isFolder: boolean} | null>(null);
  const [activeSchema, setActiveSchema] = useState<string | null>(null);

  useEffect(() => { loadTree(); loadTriggersData(); fetchKeys(); api.get('/config').then(setConfig).catch(console.error); }, []);
  useEffect(() => { const close = () => setContextMenu(null); window.addEventListener('click', close); return () => window.removeEventListener('click', close); }, []);

  const fetchKeys = async () => { try { const k = await api.get('/auth/keys'); setApiKeys(k); } catch(e) { console.error(e); } }

  const loadTree = async () => {
    try {
        const [funcs, schemas, files] = await Promise.all([api.get('/rpc'), api.get('/schemas'), api.get('/files')]);
        setFuncsList(funcs);
        const root: Record<string, TreeItem[]> = {};
        schemas.forEach((s: any) => { if (!['inercia_sys', 'auth', 'pg_catalog', 'information_schema'].includes(s.name)) root[s.name] = []; });
        if (!root['public']) root['public'] = [];
        funcs.forEach((f: any) => { if (root[f.schema]) root[f.schema].push({ name: f.name, type: 'function', schema: f.schema, def: f.def, args: f.args }); });
        files.forEach((f: any) => { if (f.schema_name && root[f.schema_name]) root[f.schema_name].push({ id: f.id, name: f.name, type: 'file', schema: f.schema_name, content: f.content }); });
        setTree(Object.keys(root).sort().map(k => ({ name: k === 'public' ? 'Geral (Public)' : k, type: 'schema', schema: k, children: root[k] })));
    } catch(e) { console.error(e); }
  };

  const loadTriggersData = async () => { try { const [t, tables] = await Promise.all([api.get('/triggers'), api.get('/tables')]); setTriggers(t); setTables(tables); } catch(e) { console.error(e); } }

  const handleSelect = (item: TreeItem) => {
      setSelectedItem(item);
      setCode(item.type === 'function' ? (item.def || '') : (item.content || ''));
      setTestResult(null);
  };

  const handleItemContextMenu = (e: React.MouseEvent, item: any, isFolder: boolean) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, target: item, isFolder });
  };

  const handleDeleteItem = async () => {
      if(!contextMenu) return;
      const { target, isFolder } = contextMenu;
      if(!confirm(`Excluir ${isFolder ? 'pasta' : 'item'} "${target.name}"?`)) return;
      try {
          if(isFolder) await api.delete(`/schemas/${target.schema}`);
          else if(target.type === 'file') await api.delete(`/files/${target.id}`);
          else await api.post('/rpc/drop', { schema: target.schema, name: target.name });
          loadTree(); showToast("Excluído!");
      } catch(e:any) { showToast(e.message, 'error'); }
  };

  const handleRenameItem = async () => {
      if(!contextMenu) return;
      const { target, isFolder } = contextMenu;
      const newName = prompt("Novo nome:", target.name);
      if(!newName || newName === target.name) return;
      try {
          if(isFolder) await api.put(`/schemas/${target.schema}`, { newName });
          else if(target.type === 'file') { /* Update file logic if backend supports renaming */ }
          else { /* Rename SQL func via query */ }
          loadTree(); showToast("Renomeado!");
      } catch(e:any) { showToast(e.message, 'error'); }
  };

  const handleDuplicateItem = async () => {
      if(!contextMenu || contextMenu.isFolder) return;
      const item = contextMenu.target;
      try {
          if(item.type === 'file') {
              await api.post('/files', { name: `${item.name}_copy`, content: item.content, schema_name: item.schema });
          } else {
              const newSql = item.def.replace(new RegExp(item.name, 'g'), `${item.name}_copy`);
              await api.post('/sql', { query: newSql, schema: item.schema });
          }
          loadTree(); showToast("Duplicado!");
      } catch(e:any) { showToast(e.message, 'error'); }
  };

  const checkAndRun = async () => {
      if (selectedItem?.type === 'file' && selectedItem.id) {
          try { await api.put(`/files/${selectedItem.id}`, { content: code }); loadTree(); showToast("Salvo!"); } 
          catch(e:any) { showToast(e.message, 'error'); }
          return;
      }
      // SQL Logic...
      try {
          await api.post('/sql', { query: code, schema: selectedItem?.schema || activeSchema || 'public' });
          loadTree(); showToast("SQL Executado!");
      } catch(e:any) { showToast(e.message, 'error'); }
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
        <div className="flex gap-4 border-b border-slate-700 pb-2">
            <button onClick={() => setActiveTab('code')} className={`px-4 py-2 rounded font-bold text-sm ${activeTab === 'code' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>Code Editor</button>
            <button onClick={() => setActiveTab('triggers')} className={`px-4 py-2 rounded font-bold text-sm ${activeTab === 'triggers' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>Database Triggers</button>
        </div>

        {activeTab === 'code' && (
            <div className="flex flex-1 gap-4 overflow-hidden">
                {contextMenu && (
                    <div className="fixed bg-slate-800 border border-slate-600 rounded shadow-xl py-1 z-[60] w-48" style={{ top: contextMenu.y, left: contextMenu.x }}>
                        <button onClick={handleRenameItem} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"><Edit2 size={14}/> Renomear</button>
                        {!contextMenu.isFolder && <button onClick={handleDuplicateItem} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"><CopyIcon size={14}/> Duplicar</button>}
                        <button onClick={handleDeleteItem} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2 border-t border-slate-700"><Trash2 size={14}/> Excluir</button>
                    </div>
                )}

                <div className="w-64 bg-slate-800 rounded border border-slate-700 flex flex-col">
                    <div className="p-3 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase">Explorer</span>
                        <button onClick={() => setModalType('createFolder')} className="text-emerald-400 hover:text-white"><FolderPlus size={16}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {tree.map(node => (
                            <div key={node.schema}>
                                <div 
                                    className="flex items-center justify-between text-slate-300 hover:bg-slate-700 px-2 py-1 rounded cursor-pointer group" 
                                    onClick={() => setExpanded({...expanded, [node.schema!]: !expanded[node.schema!]})}
                                    onContextMenu={(e) => handleItemContextMenu(e, node, true)}
                                >
                                    <div className="flex items-center gap-1">
                                        {expanded[node.schema!] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                        <Folder size={14} className="text-blue-400" />
                                        <span className="text-sm truncate">{node.name}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); setTargetSchema(node.schema!); setModalType('createItem'); }} className="opacity-0 group-hover:opacity-100"><Plus size={14}/></button>
                                </div>
                                {expanded[node.schema!] && (
                                    <div className="ml-4 border-l border-slate-700 pl-2">
                                        {node.children?.map((item, i) => (
                                            <div 
                                                key={i} 
                                                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm ${selectedItem === item ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`} 
                                                onClick={() => handleSelect(item)}
                                                onDoubleClick={() => { handleSelect(item); /* set editing mode */ }}
                                                onContextMenu={(e) => handleItemContextMenu(e, item, false)}
                                            >
                                                {item.type === 'function' ? <FileCode size={14} /> : <FileText size={14} />}
                                                <span className="truncate">{item.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-4">
                    <div className="flex-1 bg-slate-950 border border-slate-700 rounded overflow-hidden flex flex-col">
                        <div className="bg-slate-900 p-2 flex justify-between items-center border-b border-slate-700">
                            <span className="text-xs font-mono text-slate-500">{selectedItem ? `${selectedItem.schema}/${selectedItem.name}` : 'Nenhum item selecionado'}</span>
                            <button onClick={checkAndRun} className="bg-emerald-600 text-white px-4 py-1 rounded text-xs font-bold flex items-center gap-2 hover:bg-emerald-500"><Save size={14}/> Salvar / Executar</button>
                        </div>
                        <textarea className="flex-1 bg-transparent p-4 text-emerald-300 font-mono text-sm focus:outline-none resize-none" value={code} onChange={e => setCode(e.target.value)} spellCheck="false" />
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default LogicEditor;