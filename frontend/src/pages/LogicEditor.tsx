import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Folder, FileCode, Play, Plus, ChevronRight, ChevronDown, FolderPlus, FileText, Trash2, Edit2, Save, Search, Zap, ArrowRight, Eye, EyeOff, Copy, Terminal, CheckCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

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
  const [activeTab, setActiveTab] = useState<'code' | 'triggers'>('code');

  // CODE EDITOR STATE
  const [tree, setTree] = useState<TreeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<TreeItem | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [apiKeys, setApiKeys] = useState({ anon: '', service: '' });
  const [config, setConfig] = useState<any>({});
  
  // TESTER STATE
  const [testParams, setTestParams] = useState('{}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  
  // TOAST NOTIFICATION
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  // TRIGGERS STATE
  const [triggers, setTriggers] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [funcsList, setFuncsList] = useState<any[]>([]);
  const [newTrigger, setNewTrigger] = useState({ table: '', event: 'INSERT', timing: 'AFTER', function: '' });
  
  // Modals & Context
  const [modalType, setModalType] = useState<'createFolder' | 'createItem' | 'rename' | 'createTrigger' | 'overwrite' | null>(null);
  const [overwritePayload, setOverwritePayload] = useState<{name: string, schema: string, sql: string} | null>(null);
  const [targetSchema, setTargetSchema] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState<'function' | 'file'>('function');
  const [contextMenu, setContextMenu] = useState<{x:number, y:number, folder: string} | null>(null);
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);
  const [activeSchema, setActiveSchema] = useState<string | null>(null);

  useEffect(() => { 
      loadTree(); 
      loadTriggersData(); 
      fetchKeys();
      api.get('/config').then(setConfig).catch(console.error);
  }, []);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // Toast Helper
  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  const fetchKeys = async () => {
      try {
          const k = await api.get('/auth/keys');
          setApiKeys(k);
      } catch(e) { console.error(e); }
  }

  const loadTree = async () => {
    try {
        const [funcs, schemas, files] = await Promise.all([
            api.get('/rpc'),
            api.get('/schemas'),
            api.get('/files')
        ]);

        setFuncsList(funcs);

        const root: Record<string, TreeItem[]> = {};
        schemas.forEach((s: any) => {
             if (!['inercia_sys', 'public', 'auth', 'pg_catalog', 'information_schema'].includes(s.name)) {
                 if(!root[s.name]) root[s.name] = [];
             }
        });

        funcs.forEach((f: any) => {
            if (root[f.schema]) {
                root[f.schema].push({ name: f.name, type: 'function', schema: f.schema, def: f.def, args: f.args });
            }
        });

        files.forEach((f: any) => {
            if (f.schema_name && root[f.schema_name]) {
                root[f.schema_name].push({ id: f.id, name: f.name, type: 'file', schema: f.schema_name, content: f.content });
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

  const loadTriggersData = async () => {
      try {
          const [t, tables] = await Promise.all([
              api.get('/triggers'),
              api.get('/tables')
          ]);
          setTriggers(t);
          setTables(tables);
      } catch(e) { console.error(e); }
  }

  const handleSelect = (item: TreeItem) => {
      setSelectedItem(item);
      if (item.type === 'function') {
          setCode(item.def || '');
          setTestResult(null);
          setTestParams('{}');
      }
      else if (item.type === 'file') setCode(item.content || '');
      setResult(null);
  };

  const handleSchemaClick = (schemaName: string) => {
      setExpanded({...expanded, [schemaName]: !expanded[schemaName]});
      setActiveSchema(schemaName); 
  };

  const extractFunctionName = (sql: string) => {
      const match = sql.match(/(?:CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+)(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_"\.]+)/i);
      if (match && match[1]) {
          const parts = match[1].split('.');
          const name = parts.length > 1 ? parts[1].replace(/"/g, '') : parts[0].replace(/"/g, '');
          const schema = parts.length > 1 ? parts[0].replace(/"/g, '') : activeSchema || 'public';
          return { name, schema };
      }
      return null;
  };

  const executeSave = async (payload?: {name: string, schema: string, sql: string, overwrite?: boolean, version?: boolean}) => {
      const contextSchema = payload?.schema || selectedItem?.schema || activeSchema; 
      let sqlToRun = payload?.sql || code;
      
      if (payload?.version) {
          let newName = `${payload.name}_1`;
          sqlToRun = sqlToRun.replace(new RegExp(payload.name, 'g'), newName);
      }
      
      if (payload?.overwrite) {
          try {
              await api.post('/rpc/drop', { schema: payload.schema, name: payload.name });
          } catch(e) { console.error("Drop failed", e); }
      }

      try {
          const res = await api.post('/sql', { query: sqlToRun, schema: contextSchema });
          setResult({ status: 'success', data: res });
          if (res.createdFunction) { 
              loadTree(); 
              loadTriggersData(); 
              setModalType(null);
              showToast("Função salva com sucesso!");
          } else {
              showToast("SQL executado com sucesso!");
          }
      } catch (e: any) {
          setResult({ status: 'error', message: e.message });
          showToast(e.message, 'error');
      }
  };

  const checkAndRun = async () => {
      setResult(null);
      if (selectedItem?.type === 'file' && selectedItem.id) {
          try {
              await api.put(`/files/${selectedItem.id}`, { content: code });
              setResult({ status: 'success', data: { message: "Arquivo salvo com sucesso!" } });
              loadTree();
              showToast("Arquivo salvo!");
          } catch(e:any) { 
              setResult({ status: 'error', message: "Erro: " + e.message }); 
              showToast("Erro ao salvar arquivo", 'error');
          }
          return;
      }

      const meta = extractFunctionName(code);
      if (!meta) {
          executeSave();
          return;
      }

      const exists = funcsList.find(f => f.name === meta.name && f.schema === meta.schema);
      if (exists) {
          setOverwritePayload({ name: meta.name, schema: meta.schema, sql: code });
          setModalType('overwrite');
      } else {
          executeSave();
      }
  };

  const runTester = async () => {
      if (!selectedItem || selectedItem.type !== 'function') return;
      setTesting(true);
      setTestResult(null);
      try {
          let body = {};
          try { body = JSON.parse(testParams); } catch(e) { throw new Error("JSON inválido nos parâmetros."); }
          
          const res = await api.post(`/rpc/${selectedItem.schema}.${selectedItem.name}`, body);
          setTestResult(res);
          showToast("Função executada via API!");
      } catch (e: any) {
          setTestResult({ error: e.message });
          showToast("Erro na execução", 'error');
      } finally {
          setTesting(false);
      }
  };

  const copyCurl = () => {
      if (!selectedItem || selectedItem.type !== 'function') return;
      const url = `${config.apiExternalUrl || 'http://localhost:3000'}/api/rpc/${selectedItem.schema}.${selectedItem.name}`;
      const curl = `curl -X POST ${url} \\
  -H "Authorization: Bearer ${apiKeys.anon}" \\
  -H "apikey: ${apiKeys.anon}" \\
  -H "Content-Type: application/json" \\
  -d '${testParams.replace(/'/g, "'\\''")}'`;
      
      navigator.clipboard.writeText(curl);
      showToast("cURL copiado com chaves API!");
  };

  // ... Trigger handlers ... (No changes needed)
  const handleCreateTrigger = async () => {
      if(!newTrigger.table || !newTrigger.function) return showToast("Selecione tabela e função.", 'error');
      const tableName = newTrigger.table;
      const schemaName = tables.find(t => t.table_name === tableName)?.table_schema || 'public';
      const funcName = newTrigger.function;
      const triggerName = `trig_${tableName}_${newTrigger.event.toLowerCase()}`;
      try {
          await api.post('/triggers', { schema: schemaName, table: tableName, name: triggerName, timing: newTrigger.timing, event: newTrigger.event, functionName: funcName });
          setModalType(null); loadTriggersData(); showToast("Gatilho criado!");
      } catch(e: any) { showToast(e.message, 'error'); }
  }
  const handleDeleteTrigger = async (t: any) => { if(!confirm("Excluir gatilho?")) return; try { await api.delete('/triggers', { schema: t.schema, table: t.table, name: t.trigger_name }); loadTriggersData(); showToast("Gatilho removido."); } catch(e:any) { showToast(e.message, 'error'); } }

  // ... Folder/Item handlers ... (No changes needed)
  const handleCreateFolder = async () => { try { await api.post('/schemas', { name: itemName }); closeModal(); loadTree(); showToast("Pasta criada"); } catch(e:any) { showToast(e.message, 'error'); } }
  const handleCreateItem = async () => { try { const schema = targetSchema; if (itemType === 'file') { await api.post('/files', { name: itemName, content: '', schema_name: schema, type: 'txt' }); } else { const template = `CREATE OR REPLACE FUNCTION ${itemName}() RETURNS TRIGGER AS $$ \nBEGIN \n  -- Logic here\n  RETURN NEW; \nEND; \n$$ LANGUAGE plpgsql;`; setCode(template); setActiveSchema(schema); setSelectedItem({ name: itemName, type: 'function', schema: schema }); } closeModal(); loadTree(); showToast("Item criado"); } catch(e:any) { showToast(e.message, 'error'); } }
  const handleDeleteFolder = async () => { if(!contextMenu) return; if(!confirm(`Excluir pasta "${contextMenu.folder}"?`)) return; try { await api.delete(`/schemas/${contextMenu.folder}`); loadTree(); showToast("Pasta excluída"); } catch(e:any) { showToast(e.message, 'error'); } }
  const handleRenameFolder = async () => { if(!contextMenu) return; const newName = prompt("Novo nome:", contextMenu.folder); if(newName && newName !== contextMenu.folder) { try { await api.put(`/schemas/${contextMenu.folder}`, { newName }); loadTree(); showToast("Renomeado!"); } catch(e:any) { showToast(e.message, 'error'); } } }
  const openCreateItemModal = (schema: string) => { setTargetSchema(schema); setModalType('createItem'); setItemName(''); }
  const onContextMenu = (e: React.MouseEvent, folder: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, folder }); }
  const closeModal = () => { setModalType(null); setItemName(''); }

  const filteredTree = tree.filter(node => {
      if (!searchTerm) return true;
      const matchName = node.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchChildren = node.children?.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchName || matchChildren;
  }).map(node => {
      if (!searchTerm) return node;
      return { ...node, children: node.children?.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())) };
  });

  return (
    <div className="flex flex-col h-full gap-4 relative">
        {/* TOAST NOTIFICATION */}
        {toast && (
            <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-bounce-in transition-all ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                {toast.type === 'success' ? <CheckCircle size={20} /> : <Zap size={20} />}
                <span className="font-bold text-sm">{toast.msg}</span>
            </div>
        )}

        {/* TOP TABS */}
        <div className="flex gap-4 border-b border-slate-700 pb-2">
            <button onClick={() => setActiveTab('code')} className={`flex items-center gap-2 px-4 py-2 rounded font-bold text-sm ${activeTab === 'code' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><FileCode size={16} /> Code Editor</button>
            <button onClick={() => setActiveTab('triggers')} className={`flex items-center gap-2 px-4 py-2 rounded font-bold text-sm ${activeTab === 'triggers' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Zap size={16} /> Database Triggers</button>
        </div>

        {/* --- CODE EDITOR VIEW --- */}
        {activeTab === 'code' && (
            <div className="flex flex-1 gap-4 overflow-hidden">
                {/* Modals */}
                {modalType === 'createFolder' && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                        <div className="bg-slate-800 p-6 rounded border border-slate-600 w-80">
                            <h3 className="text-white font-bold mb-4">Nova Pasta</h3>
                            <input className="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded mb-4" placeholder="Nome..." value={itemName} onChange={e => setItemName(e.target.value)} />
                            <div className="flex justify-end gap-2"><button onClick={closeModal} className="text-slate-400">Cancelar</button><button onClick={handleCreateFolder} className="bg-emerald-600 text-white px-4 py-2 rounded">Criar</button></div>
                        </div>
                    </div>
                )}
                {modalType === 'createItem' && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                        <div className="bg-slate-800 p-6 rounded border border-slate-600 w-96">
                            <h3 className="text-white font-bold mb-4">Novo Item em "{targetSchema}"</h3>
                            <div className="flex gap-2 mb-4">
                                <button onClick={() => setItemType('function')} className={`flex-1 py-2 rounded text-sm ${itemType === 'function' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Função SQL</button>
                                <button onClick={() => setItemType('file')} className={`flex-1 py-2 rounded text-sm ${itemType === 'file' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Arquivo TXT</button>
                            </div>
                            <input className="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded mb-4" placeholder="Nome..." value={itemName} onChange={e => setItemName(e.target.value)} />
                            <div className="flex justify-end gap-2"><button onClick={closeModal} className="text-slate-400">Cancelar</button><button onClick={handleCreateItem} className="bg-emerald-600 text-white px-4 py-2 rounded">Criar</button></div>
                        </div>
                    </div>
                )}
                {modalType === 'overwrite' && overwritePayload && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-2">Função Existente</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                A função <b>"{overwritePayload.name}"</b> já existe neste schema. O que deseja fazer?
                            </p>
                            <div className="flex flex-col gap-3">
                                <button onClick={() => executeSave({ ...overwritePayload, overwrite: true })} className="bg-red-600/20 border border-red-500 hover:bg-red-600 text-white px-4 py-3 rounded font-bold text-left transition-colors">
                                    <div className="text-sm">Substituir Completamente</div>
                                    <div className="text-[10px] font-normal text-slate-300 opacity-80">Apaga a antiga e cria a nova (Limpa vestígios).</div>
                                </button>
                                <button onClick={() => executeSave({ ...overwritePayload, version: true })} className="bg-blue-600/20 border border-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded font-bold text-left transition-colors">
                                    <div className="text-sm">Criar Nova Versão</div>
                                    <div className="text-[10px] font-normal text-slate-300 opacity-80">Salva como <b>{overwritePayload.name}_1</b> para preservar a atual.</div>
                                </button>
                                <button onClick={() => setModalType(null)} className="text-slate-500 text-sm mt-2 text-center hover:text-white">Cancelar</button>
                            </div>
                        </div>
                    </div>
                )}
                {contextMenu && (
                    <div className="fixed bg-slate-800 border border-slate-600 rounded shadow-xl py-1 z-[60] w-40" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={handleRenameFolder} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"><Edit2 size={14}/> Renomear</button>
                        <button onClick={handleDeleteFolder} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"><Trash2 size={14}/> Excluir</button>
                    </div>
                )}

                {/* Tree View */}
                <div className="w-60 flex-shrink-0 bg-slate-800 rounded border border-slate-700 flex flex-col">
                    <div className="p-3 bg-slate-900 border-b border-slate-700 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">{t.logic.explorer}</span>
                            <button onClick={() => { setModalType('createFolder'); setItemName(''); }} className="text-emerald-400 hover:text-white bg-slate-800 p-1 rounded border border-slate-700 hover:bg-slate-700" title="Nova Pasta"><FolderPlus size={16}/></button>
                        </div>
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-2 text-slate-500"/>
                            <input className="w-full bg-slate-950 border border-slate-700 rounded py-1 pl-7 pr-2 text-xs text-white focus:outline-none focus:border-emerald-500" placeholder="Buscar função..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {filteredTree.map(schema => (
                            <div key={schema.name} className="mb-1">
                                <div className={`flex items-center justify-between text-slate-300 hover:bg-slate-700 px-2 py-1 rounded cursor-pointer group ${activeSchema === schema.name ? 'bg-slate-700/50' : ''}`} onClick={() => handleSchemaClick(schema.name)} onMouseEnter={() => setHoveredFolder(schema.name)} onMouseLeave={() => setHoveredFolder(null)} onContextMenu={(e) => onContextMenu(e, schema.name)}>
                                    <div className="flex items-center gap-1 overflow-hidden">
                                        {expanded[schema.name] || searchTerm ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                        <Folder size={14} className="text-blue-400" />
                                        <span className="text-sm font-bold capitalize truncate">{schema.name}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); openCreateItemModal(schema.name); }} className={`p-0.5 rounded hover:bg-emerald-600 hover:text-white transition-opacity ${hoveredFolder === schema.name ? 'opacity-100' : 'opacity-0'}`} title="Add Item"><Plus size={14} /></button>
                                </div>
                                {(expanded[schema.name] || searchTerm) && (
                                    <div className="ml-4 border-l border-slate-700 pl-2 mt-1 space-y-0.5">
                                        {schema.children?.map((item, i) => (
                                            <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm ${selectedItem === item ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`} onClick={() => handleSelect(item)}>
                                                {item.type === 'function' ? <FileCode size={14} className="flex-shrink-0" /> : <FileText size={14} className="flex-shrink-0" />}
                                                <span className="truncate">{item.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col gap-4">
                    <div className="flex-1 bg-slate-950 border border-slate-700 rounded overflow-hidden flex flex-col">
                        <div className="bg-slate-900 p-2 border-b border-slate-700 flex justify-between items-center">
                            <span className="text-xs text-slate-400 font-mono">
                                {selectedItem ? `${selectedItem.schema}/${selectedItem.name}` : (activeSchema ? `Contexto: ${activeSchema}` : 'Selecione uma pasta')}
                            </span>
                            <button onClick={checkAndRun} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold">
                                {selectedItem?.type === 'file' ? <Save size={12} /> : <Play size={12} />} 
                                {selectedItem?.type === 'file' ? ' Salvar Arquivo' : ' Executar / Salvar'}
                            </button>
                        </div>
                        <textarea 
                            className="flex-1 bg-transparent p-4 text-emerald-300 font-mono text-sm focus:outline-none resize-none"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            spellCheck="false"
                            placeholder="-- Escreva SQL aqui. O código será executado no contexto da pasta selecionada."
                        />
                    </div>
                    {/* Only show Code Execution Result if it's NOT a function test (which has its own panel) */}
                    {result && selectedItem?.type !== 'function' && (
                        <div className="h-40 bg-slate-800 border border-slate-700 rounded flex flex-col overflow-hidden">
                            <div className="bg-slate-900 p-2 border-b border-slate-700 text-xs font-bold text-slate-400">Resultados</div>
                            <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-300">
                                {result.status === 'error' ? <span className="text-red-400">{result.message}</span> : JSON.stringify(result.data, null, 2)}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL: TESTER (Only for Functions) */}
                {selectedItem?.type === 'function' && (
                    <div className="w-80 flex-shrink-0 bg-slate-800 rounded border border-slate-700 flex flex-col overflow-hidden">
                        <div className="p-3 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                            <span className="font-bold text-white text-sm flex items-center gap-2"><Terminal size={14}/> Testador de API</span>
                            <div className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-emerald-400 border border-emerald-900">RPC</div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                             <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Argumentos (JSON)</label>
                                <textarea 
                                    className="w-full h-24 bg-slate-950 border border-slate-700 rounded p-2 text-emerald-300 font-mono text-xs focus:outline-none focus:border-emerald-500 resize-none"
                                    value={testParams}
                                    onChange={e => setTestParams(e.target.value)}
                                    placeholder="{}"
                                />
                             </div>

                             <button 
                                onClick={runTester}
                                disabled={testing}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-2"
                             >
                                <Play size={14} /> {testing ? 'Executando...' : 'Testar Função'}
                             </button>

                             <div className="flex-1 flex flex-col min-h-0 border-t border-slate-700 pt-4">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Resultado</label>
                                <div className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-slate-300 font-mono text-xs overflow-auto">
                                    {testResult ? JSON.stringify(testResult, null, 2) : <span className="text-slate-600 italic">// Aguardando execução...</span>}
                                </div>
                             </div>

                             <button 
                                onClick={copyCurl} 
                                className="mt-2 w-full bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 py-2 rounded text-xs font-bold flex items-center justify-center gap-2"
                             >
                                <Copy size={14}/> Copiar cURL de Integração
                             </button>
                             <p className="text-[10px] text-center text-slate-500">
                                Copia o comando completo com chaves e parâmetros.
                             </p>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* --- TRIGGERS VIEW --- */}
        {activeTab === 'triggers' && (
            <div className="flex-1 bg-slate-800 rounded border border-slate-700 flex flex-col overflow-hidden animate-fade-in">
                 {/* Trigger Creation Modal */}
                 {modalType === 'createTrigger' && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-lg w-full">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Zap className="text-yellow-500"/> Novo Gatilho (Trigger)</h3>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-slate-400 text-xs mb-1">Quando (Timing)</label>
                                    <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newTrigger.timing} onChange={e => setNewTrigger({...newTrigger, timing: e.target.value})}>
                                        <option value="BEFORE">BEFORE (Antes)</option>
                                        <option value="AFTER">AFTER (Depois)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-xs mb-1">Evento</label>
                                    <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newTrigger.event} onChange={e => setNewTrigger({...newTrigger, event: e.target.value})}>
                                        <option value="INSERT">INSERT (Criar)</option>
                                        <option value="UPDATE">UPDATE (Editar)</option>
                                        <option value="DELETE">DELETE (Excluir)</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="mb-4">
                                <label className="block text-slate-400 text-xs mb-1">Na Tabela</label>
                                <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newTrigger.table} onChange={e => setNewTrigger({...newTrigger, table: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {tables.map(t => <option key={t.table_name} value={t.table_name}>{t.table_name}</option>)}
                                </select>
                            </div>

                            <div className="mb-6">
                                <label className="block text-slate-400 text-xs mb-1">Executar Função</label>
                                <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newTrigger.function} onChange={e => setNewTrigger({...newTrigger, function: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {funcsList.filter(f => f.def.includes('RETURNS trigger') || f.def.includes('RETURNS TRIGGER')).map(f => (
                                        <option key={f.name} value={f.name}>{f.schema}.{f.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1">Apenas funções que retornam <code>TRIGGER</code> aparecem aqui.</p>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button onClick={() => setModalType(null)} className="text-slate-400">Cancelar</button>
                                <button onClick={handleCreateTrigger} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold">Criar Gatilho</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Automação de Banco de Dados</h2>
                        <p className="text-sm text-slate-400">Conecte eventos (Insert/Update/Delete) a suas funções lógicas.</p>
                    </div>
                    <button onClick={() => { setNewTrigger({table:'', event:'INSERT', timing:'AFTER', function:''}); setModalType('createTrigger'); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded flex items-center gap-2 font-bold shadow-lg">
                        <Plus size={18}/> Novo Gatilho
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {triggers.length === 0 ? (
                        <div className="text-center text-slate-500 py-20 border-2 border-dashed border-slate-700 rounded">
                            <Zap size={48} className="mx-auto mb-4 opacity-20"/>
                            <p>Nenhum gatilho ativo.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {triggers.map((t, i) => (
                                <div key={i} className="bg-slate-900 border border-slate-700 rounded p-4 group hover:border-emerald-500/50 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <Zap size={16} className="text-yellow-500"/>
                                            <span className="text-white font-bold text-sm truncate w-40" title={t.trigger_name}>{t.trigger_name}</span>
                                        </div>
                                        <button onClick={() => handleDeleteTrigger(t)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-3 font-mono bg-slate-950 p-2 rounded">
                                        <span className="text-purple-400">{t.action_timing}</span>
                                        <span className="text-emerald-400">{t.event}</span>
                                        <span>ON</span>
                                        <span className="text-white font-bold">{t.table}</span>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <ArrowRight size={12}/> Executa: <span className="text-blue-400 font-mono">{t.action_statement.replace('EXECUTE FUNCTION ', '')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};

export default LogicEditor;