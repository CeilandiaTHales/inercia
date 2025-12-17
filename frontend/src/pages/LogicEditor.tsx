import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Folder, FileCode, Play, Plus, ChevronRight, ChevronDown, FolderPlus, FilePlus, FileText, Trash2, Edit2, MoreVertical, Save } from 'lucide-react';
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({'principal': true});
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [config, setConfig] = useState<any>({});
  
  // Modals
  const [modalType, setModalType] = useState<'createFolder' | 'createItem' | 'rename' | null>(null);
  const [targetSchema, setTargetSchema] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState<'function' | 'file'>('function');
  const [contextMenu, setContextMenu] = useState<{x:number, y:number, folder: string} | null>(null);
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);

  useEffect(() => { loadTree(); api.get('/config').then(setConfig); }, []);

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
        
        schemas.forEach((s: any) => {
             if (!['inercia_sys'].includes(s.name)) {
                 const key = s.name === 'public' ? 'principal' : s.name;
                 if(!root[key]) root[key] = [];
             }
        });
        if (!root['principal']) root['principal'] = [];

        funcs.forEach((f: any) => {
            let key = f.schema === 'public' ? 'principal' : f.schema;
            if (root[key]) {
                root[key].push({ name: f.name, type: 'function', schema: f.schema, def: f.def, args: f.args });
            }
        });

        files.forEach((f: any) => {
            const key = (!f.schema_name || f.schema_name === 'public') ? 'principal' : f.schema_name;
            if (root[key]) {
                root[key].push({ id: f.id, name: f.name, type: 'file', schema: key, content: f.content });
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

  const runOrSave = async () => {
      setResult(null);
      if (selectedItem?.type === 'file' && selectedItem.id) {
          try {
              await api.put(`/files/${selectedItem.id}`, { content: code });
              setResult({ status: 'success', data: { message: "Arquivo salvo com sucesso!" } });
              // Refresh tree data (content) in background
              loadTree();
          } catch(e:any) {
              setResult({ status: 'error', message: "Erro ao salvar: " + e.message });
          }
          return;
      }
      
      // SQL execution
      try {
          const res = await api.post('/sql', { query: code });
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
          const schema = targetSchema === 'principal' ? 'public' : targetSchema;
          if (itemType === 'file') {
               await api.post('/files', { name: itemName, content: '', schema_name: targetSchema, type: 'txt' });
          } else {
               const template = `CREATE OR REPLACE FUNCTION "${schema}"."${itemName}"() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;`;
               setCode(template);
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

  return (
    <div className="flex h-full gap-4">
        {/* Modals ... (Same as before) */}
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

        <div className="w-64 bg-slate-800 rounded border border-slate-700 flex flex-col">
            <div className="p-3 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">{t.logic.explorer}</span>
                <button onClick={() => { setModalType('createFolder'); setItemName(''); }} className="text-emerald-400 hover:text-white bg-slate-800 p-1 rounded border border-slate-700 hover:bg-slate-700" title="Nova Pasta"><FolderPlus size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {tree.map(schema => (
                    <div key={schema.name} className="mb-1">
                        <div 
                            className="flex items-center justify-between text-slate-300 hover:bg-slate-700 px-2 py-1 rounded cursor-pointer group"
                            onClick={() => setExpanded({...expanded, [schema.name]: !expanded[schema.name]})}
                            onMouseEnter={() => setHoveredFolder(schema.name)}
                            onMouseLeave={() => setHoveredFolder(null)}
                            onContextMenu={(e) => onContextMenu(e, schema.name)}
                        >
                            <div className="flex items-center gap-1 overflow-hidden">
                                {expanded[schema.name] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                <Folder size={14} className={schema.name === 'principal' ? "text-emerald-500" : "text-blue-400"} />
                                <span className="text-sm font-bold capitalize truncate">{schema.name}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); openCreateItemModal(schema.name); }} className={`p-0.5 rounded hover:bg-emerald-600 hover:text-white transition-opacity ${hoveredFolder === schema.name ? 'opacity-100' : 'opacity-0'}`} title="Add Item"><Plus size={14} /></button>
                        </div>
                        {expanded[schema.name] && (
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
                     <span className="text-xs text-slate-400 font-mono">{selectedItem ? `${selectedItem.schema}/${selectedItem.name}` : 'Editor'}</span>
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
                    placeholder="-- Escreva SQL ou conteúdo do arquivo..."
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