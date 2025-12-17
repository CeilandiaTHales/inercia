import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Folder, FileCode, Play, Plus, ChevronRight, ChevronDown, FolderPlus, FileText, Trash2, Edit2, Save, Search } from 'lucide-react';
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
  const [tree, setTree] = useState<TreeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<TreeItem | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals & Context
  const [modalType, setModalType] = useState<'createFolder' | 'createItem' | 'rename' | null>(null);
  const [targetSchema, setTargetSchema] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState<'function' | 'file'>('function');
  const [contextMenu, setContextMenu] = useState<{x:number, y:number, folder: string} | null>(null);
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);
  // Track last selected schema to implicit context
  const [activeSchema, setActiveSchema] = useState<string | null>(null);

  useEffect(() => { loadTree(); }, []);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const loadTree = async () => {
    try {
        const [funcs, schemas, files] = await Promise.all([
            api.get('/rpc'),
            api.get('/schemas'),
            api.get('/files')
        ]);

        const root: Record<string, TreeItem[]> = {};
        
        // Filter out system, 'public' (principal), and 'auth' from root folders
        schemas.forEach((s: any) => {
             if (!['inercia_sys', 'public', 'auth', 'pg_catalog', 'information_schema'].includes(s.name)) {
                 if(!root[s.name]) root[s.name] = [];
             }
        });

        funcs.forEach((f: any) => {
            // Only add if schema is in our filtered root list
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

  const handleSelect = (item: TreeItem) => {
      setSelectedItem(item);
      if (item.type === 'function') setCode(item.def || '');
      else if (item.type === 'file') setCode(item.content || '');
      setResult(null);
  };

  const handleSchemaClick = (schemaName: string) => {
      setExpanded({...expanded, [schemaName]: !expanded[schemaName]});
      setActiveSchema(schemaName); // Set context for execution
  };

  const runOrSave = async () => {
      setResult(null);
      
      // File Save
      if (selectedItem?.type === 'file' && selectedItem.id) {
          try {
              await api.put(`/files/${selectedItem.id}`, { content: code });
              setResult({ status: 'success', data: { message: "Arquivo salvo com sucesso!" } });
              loadTree();
          } catch(e:any) { setResult({ status: 'error', message: "Erro: " + e.message }); }
          return;
      }
      
      // SQL Execution with Context
      try {
          // Pass activeSchema to backend to set search_path
          const contextSchema = selectedItem?.schema || activeSchema; 
          const res = await api.post('/sql', { query: code, schema: contextSchema });
          setResult({ status: 'success', data: res });
          if (res.createdFunction) loadTree();
      } catch (e: any) {
          setResult({ status: 'error', message: e.message });
      }
  };

  const handleCreateFolder = async () => {
      try { await api.post('/schemas', { name: itemName }); closeModal(); loadTree(); } catch(e:any) { alert(e.message); }
  }

  const handleCreateItem = async () => {
      try {
          // No need to prefix with schema manually in SQL, backend will handle search_path if activeSchema is set
          // But for clarity in the template we can leave it generic
          const schema = targetSchema; 
          if (itemType === 'file') {
               await api.post('/files', { name: itemName, content: '', schema_name: schema, type: 'txt' });
          } else {
               // Template without schema prefix, relying on implicit context or user preference
               const template = `CREATE OR REPLACE FUNCTION ${itemName}() RETURNS void AS $$ \nBEGIN \n  -- Logic here \nEND; \n$$ LANGUAGE plpgsql;`;
               setCode(template);
               setActiveSchema(schema); // Ensure context is set
               setSelectedItem({ name: itemName, type: 'function', schema: schema }); // Temp selection
          }
          closeModal();
          loadTree();
      } catch(e:any) { alert(e.message); }
  }

  const handleDeleteFolder = async () => {
      if(!contextMenu) return;
      if(!confirm(`Excluir pasta "${contextMenu.folder}"?`)) return;
      try { await api.delete(`/schemas/${contextMenu.folder}`); loadTree(); } catch(e:any) { alert(e.message); }
  }

  const handleRenameFolder = async () => {
      if(!contextMenu) return;
      const newName = prompt("Novo nome:", contextMenu.folder);
      if(newName && newName !== contextMenu.folder) {
          try { await api.put(`/schemas/${contextMenu.folder}`, { newName }); loadTree(); } catch(e:any) { alert(e.message); }
      }
  }

  const openCreateItemModal = (schema: string) => { setTargetSchema(schema); setModalType('createItem'); setItemName(''); }
  const onContextMenu = (e: React.MouseEvent, folder: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, folder }); }
  const closeModal = () => { setModalType(null); setItemName(''); }

  // Search Logic
  const filteredTree = tree.filter(node => {
      if (!searchTerm) return true;
      const matchName = node.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchChildren = node.children?.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchName || matchChildren;
  }).map(node => {
      if (!searchTerm) return node;
      // If searching, filter children too
      return {
          ...node,
          children: node.children?.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      };
  });

  return (
    <div className="flex h-full gap-4">
        {/* Modals ... */}
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
        {contextMenu && (
            <div className="fixed bg-slate-800 border border-slate-600 rounded shadow-xl py-1 z-[60] w-40" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
                <button onClick={handleRenameFolder} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"><Edit2 size={14}/> Renomear</button>
                <button onClick={handleDeleteFolder} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"><Trash2 size={14}/> Excluir</button>
            </div>
        )}

        {/* Sidebar */}
        <div className="w-64 bg-slate-800 rounded border border-slate-700 flex flex-col">
            <div className="p-3 bg-slate-900 border-b border-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase">{t.logic.explorer}</span>
                    <button onClick={() => { setModalType('createFolder'); setItemName(''); }} className="text-emerald-400 hover:text-white bg-slate-800 p-1 rounded border border-slate-700 hover:bg-slate-700" title="Nova Pasta"><FolderPlus size={16}/></button>
                </div>
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-2 text-slate-500"/>
                    <input 
                        className="w-full bg-slate-950 border border-slate-700 rounded py-1 pl-7 pr-2 text-xs text-white focus:outline-none focus:border-emerald-500" 
                        placeholder="Buscar função..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {filteredTree.map(schema => (
                    <div key={schema.name} className="mb-1">
                        <div 
                            className={`flex items-center justify-between text-slate-300 hover:bg-slate-700 px-2 py-1 rounded cursor-pointer group ${activeSchema === schema.name ? 'bg-slate-700/50' : ''}`}
                            onClick={() => handleSchemaClick(schema.name)}
                            onMouseEnter={() => setHoveredFolder(schema.name)}
                            onMouseLeave={() => setHoveredFolder(null)}
                            onContextMenu={(e) => onContextMenu(e, schema.name)}
                        >
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
                     <span className="text-xs text-slate-400 font-mono">
                         {selectedItem ? `${selectedItem.schema}/${selectedItem.name}` : (activeSchema ? `Contexto: ${activeSchema}` : 'Selecione uma pasta')}
                     </span>
                     <button onClick={runOrSave} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold">
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