import React, { useEffect, useState, useRef } from 'react';
import { api, copyToClipboard } from '../api';
import { Plus, Trash2, Edit2, Save, X, Search, Upload, FilePlus, GripHorizontal, Copy, Pencil, Download, CheckSquare, Square, Layers } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

const TableEditor = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [pk, setPk] = useState<string>('id');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  // Multi Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Column Management (Order & Width)
  const [orderedColumns, setOrderedColumns] = useState<any[]>([]);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingCol = useRef<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // CSV State
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvMode, setCsvMode] = useState<'existing' | 'new'>('existing');
  const [csvContent, setCsvContent] = useState('');
  const [newTableName, setNewTableName] = useState('');

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  
  // Create Table Manual
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [manualTableName, setManualTableName] = useState('');
  const [manualCols, setManualCols] = useState([{ name: 'name', type: 'text', nullable: true }]);

  // CONTEXT MENU STATE
  const [contextMenu, setContextMenu] = useState<{x:number, y:number, table: any} | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');

  // BULK DELETE MODAL
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkGapFill, setBulkGapFill] = useState(false);

  useEffect(() => { refreshTables(); }, []);
  
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const refreshTables = () => api.get('/tables').then(setTables).catch(console.error);

  const fetchTableData = async (schema: string, table: string) => {
    setLoading(true);
    setSelectedTable({ schema, table });
    setIsAdding(false);
    setEditingId(null);
    setSelectedIds(new Set()); // Reset selection
    try {
        const meta = await api.get(`/tables/${schema}/${table}/meta`);
        setColumns(meta);
        setOrderedColumns(meta); 
        
        const initialWidths: Record<string, number> = {};
        meta.forEach((c: any) => initialWidths[c.column_name] = 150);
        setColWidths(prev => ({ ...initialWidths, ...prev }));

        const res = await api.get(`/tables/${schema}/${table}/data`);
        setRows(res.data);
        setPk(res.pk);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  // --- Multi Selection Logic ---
  const toggleSelectAll = () => {
      if (selectedIds.size === rows.length && rows.length > 0) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(rows.map(r => r[pk].toString())));
      }
  };

  const toggleSelectRow = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const getSelectedRowsData = () => {
      return rows.filter(r => selectedIds.has(r[pk].toString()));
  }

  // --- Context Menu Handlers ---
  const handleContextMenu = (e: React.MouseEvent, table: any) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, table });
  };

  const handleCopy = (text: string) => {
      copyToClipboard(text)
        .then(() => showToast("Copiado!"))
        .catch(err => showToast("Erro ao copiar", 'error'));
  };

  const handleCopyName = (e: React.MouseEvent) => {
      e.stopPropagation();
      if(contextMenu) {
          handleCopy(contextMenu.table.table_name);
          setContextMenu(null);
      }
  };

  const handleCopySchema = (e: React.MouseEvent) => {
      e.stopPropagation();
      if(contextMenu) {
          // Use table_schema from the table object
          handleCopy(contextMenu.table.table_schema);
          setContextMenu(null);
      }
  };

  const handleOpenRename = () => {
      if(contextMenu) {
          setRenameTarget(contextMenu.table);
          setNewName(contextMenu.table.table_name);
          setShowRenameModal(true);
      }
  };

  const executeRename = async () => {
      if(!renameTarget || !newName) return;
      try {
          await api.post('/tables/rename', { schema: renameTarget.table_schema, oldName: renameTarget.table_name, newName });
          refreshTables();
          if(selectedTable?.table === renameTarget.table_name) {
              setSelectedTable(null); 
          }
          setShowRenameModal(false);
          showToast("Renomeado com sucesso!");
      } catch(e:any) { showToast(e.message, 'error'); }
  };

  const handleDeleteRequest = async () => {
      if(!contextMenu) return;
      const t = contextMenu.table;
      try {
          const res = await api.get(`/tables/${t.table_schema}/${t.table_name}/data?limit=6`); 
          const count = res.data.length;
          if (count > 5) {
              setShowDeleteConfirm(t);
              setDeleteConfirmationName('');
          } else {
              if(confirm(`Tem certeza que deseja excluir a tabela "${t.table_name}"?`)) {
                  await api.post('/tables/delete', { schema: t.table_schema, table: t.table_name });
                  refreshTables();
                  if(selectedTable?.table === t.table_name) setSelectedTable(null);
                  showToast("Tabela excluída.");
              }
          }
      } catch(e) { console.error(e); }
  };

  const executeDelete = async () => {
      if(!showDeleteConfirm) return;
      if(deleteConfirmationName !== showDeleteConfirm.table_name) return;
      try {
          await api.post('/tables/delete', { schema: showDeleteConfirm.table_schema, table: showDeleteConfirm.table_name });
          refreshTables();
          if(selectedTable?.table === showDeleteConfirm.table_name) setSelectedTable(null);
          setShowDeleteConfirm(null);
          showToast("Tabela excluída.");
      } catch(e:any) { showToast(e.message, 'error'); }
  };


  // --- Bulk Actions ---
  const handleBulkDownload = () => {
      const selectedData = getSelectedRowsData();
      if(selectedData.length === 0) return;
      const headers = Object.keys(selectedData[0]);
      const csv = [
          headers.join(','),
          ...selectedData.map(row => headers.map(fieldName => JSON.stringify(row[fieldName])).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTable.table}_selected.csv`;
      a.click();
  };

  const handleBulkCopy = () => {
      const selectedData = getSelectedRowsData();
      if(selectedData.length === 0) return;
      const headers = Object.keys(selectedData[0]);
      const csv = [
          headers.join(','),
          ...selectedData.map(row => headers.map(fieldName => JSON.stringify(row[fieldName])).join(','))
      ].join('\n');
      
      handleCopy(csv);
  };

  const handleBulkDeleteInit = () => {
      if (selectedIds.size === 0) return;
      setBulkGapFill(false);
      setShowBulkDelete(true);
  };

  const handleBulkDeleteExecute = async () => {
      try {
          await api.post(`/tables/${selectedTable.schema}/${selectedTable.table}/rows/delete`, {
              ids: Array.from(selectedIds),
              gapFill: bulkGapFill,
              pk: pk
          });
          // Refresh data
          fetchTableData(selectedTable.schema, selectedTable.table);
          setShowBulkDelete(false);
          showToast(`${selectedIds.size} linhas excluídas.`);
      } catch(e: any) {
          showToast(e.message, 'error');
      }
  };


  // --- Column Resizing Logic ---
  const startResizing = (e: React.MouseEvent, colName: string) => {
      e.stopPropagation(); 
      resizingCol.current = colName;
      const startX = e.clientX;
      const startWidth = colWidths[colName] || 150;

      const onMouseMove = (moveEvent: MouseEvent) => {
          if (resizingCol.current) {
              const diff = moveEvent.clientX - startX;
              const newWidth = Math.max(50, startWidth + diff); 
              setColWidths(prev => ({ ...prev, [colName]: newWidth }));
          }
      };
      const onMouseUp = () => {
          resizingCol.current = null;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
  };

  const handleDragStart = (e: React.DragEvent, position: number) => {
      dragItem.current = position;
      e.dataTransfer.effectAllowed = "move"; 
  };
  const handleDragEnter = (e: React.DragEvent, position: number) => {
      dragOverItem.current = position;
  };
  const handleDragEnd = () => {
      if (dragItem.current !== null && dragOverItem.current !== null) {
          const newOrdered = [...orderedColumns];
          const draggedItemContent = newOrdered[dragItem.current];
          newOrdered.splice(dragItem.current, 1);
          newOrdered.splice(dragOverItem.current, 0, draggedItemContent);
          setOrderedColumns(newOrdered);
      }
      dragItem.current = null;
      dragOverItem.current = null;
  };

  const handleImport = async () => {
      if (!csvContent) return;
      try {
          const lines = csvContent.trim().split('\n');
          if (lines.length < 2) throw new Error("CSV must have header and at least one row");
          const headers = lines[0].split(',').map(h => h.trim());
          const rowsToInsert = lines.slice(1).map(line => {
              const values = line.split(',');
              const obj: any = {};
              headers.forEach((h, i) => { if (values[i] !== undefined) obj[h] = values[i].trim(); });
              return obj;
          });
          const targetTable = csvMode === 'new' ? newTableName : selectedTable?.table;
          const targetSchema = csvMode === 'new' ? 'public' : selectedTable?.schema;
          if (!targetTable) return showToast("Table name required", 'error');
          await api.post(`/import/csv`, { schema: targetSchema, table: targetTable, rows: rowsToInsert, createTable: csvMode === 'new' });
          setShowImportModal(false); setCsvContent(''); setNewTableName(''); refreshTables();
          if (csvMode === 'existing') fetchTableData(targetSchema, targetTable);
          showToast('Importado com sucesso!');
      } catch (e: any) { showToast("Falha na importação: " + e.message, 'error'); }
  };

  const createManualTable = async () => {
      try { await api.post('/tables/create', { name: manualTableName, columns: manualCols }); setShowCreateModal(false); setManualTableName(''); setManualCols([{ name: 'name', type: 'text', nullable: true }]); refreshTables(); showToast("Tabela criada!"); } catch(e: any) { showToast(e.message, 'error'); }
  };

  const formatDateForInput = (isoString: string) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      const offset = date.getTimezoneOffset() * 60000;
      return (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
  };

  const handleInputChange = (colName: string, value: any) => { setFormData({ ...formData, [colName]: value }); };

  const saveRow = async () => {
      const { schema, table } = selectedTable;
      try {
          if (isAdding) {
              const newRow = await api.post(`/tables/${schema}/${table}/data`, formData);
              setRows([...rows, newRow]); setIsAdding(false);
              showToast("Linha criada!");
          } else if (editingId) {
              const updated = await api.put(`/tables/${schema}/${table}/data/${editingId}?pk=${pk}`, formData);
              setRows(rows.map(r => r[pk] === editingId ? updated : r)); setEditingId(null);
              showToast("Salvo!");
          }
      } catch(e:any) { showToast(e.message, 'error'); }
  };

  const deleteRow = async (id: string) => {
      if(!confirm(t.browser.confirm_delete)) return;
      const { schema, table } = selectedTable;
      await api.delete(`/tables/${schema}/${table}/data/${id}?pk=${pk}`);
      setRows(rows.filter(r => r[pk] !== id));
      showToast("Deletado.");
  };

  // Determine if Gap Fill is applicable (simple check for integer pk)
  const isGapFillAvailable = () => {
      const pkCol = columns.find(c => c.column_name === pk);
      return pkCol && (pkCol.data_type.includes('int') || pkCol.data_type.includes('serial'));
  };

  return (
    <div className="flex h-full w-full gap-2 relative">
       {/* Context Menu */}
       {contextMenu && (
           <div 
             className="fixed bg-slate-800 border border-slate-600 rounded shadow-2xl py-1 z-[99] w-48 text-sm"
             style={{ top: contextMenu.y, left: contextMenu.x }}
             onClick={(e) => e.stopPropagation()}
           >
                <div className="px-4 py-2 border-b border-slate-700 text-xs text-slate-500 font-bold uppercase">{contextMenu.table.table_name}</div>
                <button onClick={handleCopyName} className="w-full text-left px-4 py-2 text-slate-300 hover:bg-slate-700 flex items-center gap-2"><Copy size={14}/> Copiar Nome</button>
                <button onClick={handleCopySchema} className="w-full text-left px-4 py-2 text-slate-300 hover:bg-slate-700 flex items-center gap-2"><Layers size={14}/> Copiar Schema</button>
                <button onClick={handleOpenRename} className="w-full text-left px-4 py-2 text-slate-300 hover:bg-slate-700 flex items-center gap-2"><Pencil size={14}/> Renomear</button>
                <button onClick={handleDeleteRequest} className="w-full text-left px-4 py-2 text-red-400 hover:bg-slate-700 flex items-center gap-2"><Trash2 size={14}/> Excluir Tabela</button>
           </div>
       )}

       {/* Rename Modal */}
       {showRenameModal && (
           <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
               <div className="bg-slate-900 border border-slate-700 rounded p-6 w-80">
                   <h3 className="text-white font-bold mb-4">Renomear Tabela</h3>
                   <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white mb-4" value={newName} onChange={e => setNewName(e.target.value)} />
                   <div className="flex justify-end gap-2"><button onClick={() => setShowRenameModal(false)} className="text-slate-400">Cancelar</button><button onClick={executeRename} className="bg-emerald-600 text-white px-4 py-2 rounded">Salvar</button></div>
               </div>
           </div>
       )}

       {/* Safe Delete Modal */}
       {showDeleteConfirm && (
           <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
               <div className="bg-slate-900 border border-slate-700 rounded p-6 w-96 shadow-2xl">
                   <h3 className="text-white font-bold mb-2 text-red-500 flex items-center gap-2"><Trash2/> Atenção!</h3>
                   <p className="text-slate-400 text-sm mb-4">Esta tabela contém muitos dados. Para evitar acidentes, digite o nome da tabela <b>"{showDeleteConfirm.table_name}"</b> para confirmar a exclusão.</p>
                   <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white mb-4" placeholder={showDeleteConfirm.table_name} value={deleteConfirmationName} onChange={e => setDeleteConfirmationName(e.target.value)} />
                   <div className="flex justify-end gap-2"><button onClick={() => setShowDeleteConfirm(null)} className="text-slate-400">Cancelar</button><button onClick={executeDelete} disabled={deleteConfirmationName !== showDeleteConfirm.table_name} className="bg-red-600 disabled:opacity-50 text-white px-4 py-2 rounded font-bold">Excluir Tabela</button></div>
               </div>
           </div>
       )}

       {/* Bulk Delete Modal */}
       {showBulkDelete && (
           <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
               <div className="bg-slate-900 border border-slate-700 rounded p-6 w-96 shadow-2xl">
                   <h3 className="text-white font-bold mb-4 text-red-500 flex items-center gap-2"><Trash2/> Excluir {selectedIds.size} linhas?</h3>
                   
                   {isGapFillAvailable() ? (
                        <div className="bg-slate-800 p-3 rounded mb-4">
                             <label className="flex items-start gap-2 cursor-pointer">
                                 <input type="checkbox" className="mt-1" checked={bulkGapFill} onChange={e => setBulkGapFill(e.target.checked)} />
                                 <div>
                                     <span className="text-white font-bold text-sm block">Preencher Lacunas</span>
                                     <span className="text-slate-400 text-xs block mt-1">
                                         Mover os últimos registros da tabela para ocupar os IDs que serão excluídos, mantendo a sequência numérica sem buracos.
                                     </span>
                                 </div>
                             </label>
                        </div>
                   ) : (
                       <p className="text-slate-500 text-sm mb-4">Esta tabela não usa ID numérico/serial, portanto a reordenação automática não está disponível.</p>
                   )}

                   <div className="flex justify-end gap-2">
                       <button onClick={() => setShowBulkDelete(false)} className="text-slate-400">Cancelar</button>
                       <button onClick={handleBulkDeleteExecute} className="bg-red-600 text-white px-4 py-2 rounded font-bold">Confirmar Exclusão</button>
                   </div>
               </div>
           </div>
       )}

       {/* Import Modal */}
       {showImportModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-lg w-full shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4">Importar CSV</h2>
                <div className="flex gap-4 mb-4">
                    <button onClick={() => setCsvMode('existing')} className={`px-4 py-2 rounded ${csvMode === 'existing' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Tabela Existente</button>
                    <button onClick={() => setCsvMode('new')} className={`px-4 py-2 rounded ${csvMode === 'new' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Criar Nova Tabela</button>
                </div>
                {csvMode === 'new' && <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white mb-4" placeholder="Nome da Nova Tabela" value={newTableName} onChange={e => setNewTableName(e.target.value)} />}
                <textarea className="w-full h-40 bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono text-xs mb-4" placeholder="nome,idade,ativo&#10;João,30,true" value={csvContent} onChange={e => setCsvContent(e.target.value)} />
                 <div className="flex justify-end gap-2">
                    <button onClick={() => setShowImportModal(false)} className="text-slate-400">Cancelar</button>
                    <button onClick={handleImport} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">Processar</button>
                </div>
            </div>
          </div>
      )}
      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-lg w-full">
                <h2 className="text-xl font-bold text-white mb-4">Criar Tabela</h2>
                <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white mb-4" placeholder="Nome da Tabela" value={manualTableName} onChange={e => setManualTableName(e.target.value)} />
                <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                    {manualCols.map((c, i) => (
                        <div key={i} className="flex gap-2">
                            <input className="bg-slate-950 border border-slate-700 rounded p-1 text-white flex-1" placeholder="Coluna" value={c.name} onChange={e => {const n = [...manualCols]; n[i].name = e.target.value; setManualCols(n)}} />
                            <select className="bg-slate-950 border border-slate-700 rounded p-1 text-white text-xs" value={c.type} onChange={e => {const n = [...manualCols]; n[i].type = e.target.value; setManualCols(n)}}>
                                <option value="text">Text</option><option value="varchar(255)">Varchar</option><option value="integer">Integer</option><option value="boolean">Boolean</option><option value="timestamp">Timestamp</option><option value="date">Date</option><option value="jsonb">JSON</option><option value="uuid">UUID</option><option value="numeric">Numeric</option>
                            </select>
                            <button onClick={() => setManualCols(manualCols.filter((_, idx) => idx !== i))} className="text-red-400"><X size={16}/></button>
                        </div>
                    ))}
                    <button onClick={() => setManualCols([...manualCols, {name:'', type:'text', nullable:true}])} className="text-emerald-400 text-sm flex items-center gap-1"><Plus size={14}/> Add Coluna</button>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setShowCreateModal(false)} className="text-slate-400">Cancelar</button>
                    <button onClick={createManualTable} className="bg-emerald-600 text-white px-4 py-2 rounded">Criar</button>
                </div>
            </div>
        </div>
      )}

      {/* Sidebar List */}
      <div className="w-60 flex-shrink-0 bg-slate-800 rounded-lg border border-slate-700 flex flex-col h-full">
          <div className="p-3 bg-slate-900 border-b border-slate-700">
             <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold text-white text-sm">Tabelas</h2>
                <div className="flex gap-1">
                    <button onClick={() => { setCsvMode('new'); setShowImportModal(true); }} className="text-blue-400 hover:text-white" title="Importar CSV"><Upload size={16}/></button>
                    <button onClick={() => setShowCreateModal(true)} className="text-emerald-400 hover:text-white" title="Nova Tabela"><FilePlus size={16}/></button>
                </div>
             </div>
             <div className="relative">
                <Search size={14} className="absolute left-2 top-2.5 text-slate-500"/>
                <input className="w-full bg-slate-950 border border-slate-700 rounded py-1 pl-8 pr-2 text-xs text-white focus:outline-none focus:border-emerald-500" placeholder="Buscar..." value={filter} onChange={e => setFilter(e.target.value)}/>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-1">
             {tables.filter(t => t.table_name.includes(filter)).map(t => (
                 <button 
                    key={t.table_name} 
                    onClick={() => fetchTableData(t.table_schema, t.table_name)}
                    onContextMenu={(e) => handleContextMenu(e, t)}
                    className={`w-full text-left px-3 py-2 rounded mb-1 text-xs flex items-center gap-2 ${selectedTable?.table === t.table_name ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700'}`}
                 >
                    <span className="text-[10px] bg-slate-900 px-1 rounded text-slate-500">{t.table_schema.slice(0,3)}</span>
                    <span className="truncate">{t.table_name}</span>
                 </button>
             ))}
          </div>
      </div>

      {/* Main Data View */}
      <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 flex flex-col overflow-hidden h-full shadow-xl relative">
          
          {/* BULK ACTIONS BAR (FLOATING) */}
          {selectedIds.size > 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-600 shadow-2xl rounded-full px-6 py-2 flex items-center gap-4 animate-bounce-in">
                  <span className="text-white font-bold text-sm">{selectedIds.size} selecionados</span>
                  <div className="h-4 w-px bg-slate-700"></div>
                  <button onClick={handleBulkCopy} className="text-slate-300 hover:text-white flex items-center gap-1 text-xs font-medium" title="Copiar CSV"><Copy size={14}/> Copiar</button>
                  <button onClick={handleBulkDownload} className="text-slate-300 hover:text-white flex items-center gap-1 text-xs font-medium" title="Baixar CSV"><Download size={14}/> Baixar</button>
                  <div className="h-4 w-px bg-slate-700"></div>
                  <button onClick={handleBulkDeleteInit} className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs font-medium"><Trash2 size={14}/> Excluir</button>
                  <button onClick={() => setSelectedIds(new Set())} className="text-slate-500 hover:text-slate-300 ml-2"><X size={14}/></button>
              </div>
          )}

          {selectedTable ? (
              <>
                <div className="p-3 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">{selectedTable.table} <span className="text-slate-500 text-sm">({rows.length} rows)</span></h2>
                    <div className="flex gap-2">
                        <button onClick={() => {setCsvMode('existing'); setShowImportModal(true);}} className="bg-slate-700 text-white px-3 py-1 rounded text-xs flex items-center gap-2 hover:bg-slate-600"><Upload size={14}/> CSV</button>
                        {!isAdding && !editingId && <button onClick={() => {setFormData({}); setIsAdding(true);}} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs flex items-center gap-2 hover:bg-emerald-500"><Plus size={14}/> Novo</button>}
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto bg-slate-900/50">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-slate-950 sticky top-0 z-20 shadow">
                            <tr>
                                <th className="p-2 border-b border-slate-700 w-10 bg-slate-950 z-20 text-center">
                                    <button onClick={toggleSelectAll} className="text-slate-500 hover:text-white">
                                        {selectedIds.size > 0 && selectedIds.size === rows.length ? <CheckSquare size={14} className="text-emerald-500"/> : <Square size={14}/>}
                                    </button>
                                </th>
                                <th className="p-2 border-b border-slate-700 w-10 bg-slate-950 z-20"></th>
                                {orderedColumns.map((c, index) => (
                                    <th 
                                        key={c.column_name} 
                                        className="p-2 border-b border-slate-700 text-xs text-slate-400 uppercase font-bold bg-slate-950 relative group select-none hover:bg-slate-900 transition-colors cursor-grab active:cursor-grabbing"
                                        style={{ width: colWidths[c.column_name] || 150 }}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragEnter={(e) => handleDragEnter(e, index)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="truncate" title={c.column_name}>{c.column_name}</span>
                                            <span className="text-[9px] font-normal lowercase ml-1 text-slate-600">{c.data_type}</span>
                                        </div>
                                        <div 
                                            className="absolute right-0 top-0 bottom-0 w-1 hover:bg-emerald-500 cursor-col-resize z-30 transition-colors"
                                            onMouseDown={(e) => startResizing(e, c.column_name)}
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </th>
                                ))}
                                <th className="p-2 border-b border-slate-700 w-20 bg-slate-950 sticky right-0 z-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {isAdding && (
                                <tr className="bg-emerald-900/10">
                                    <td className="p-2 border-r border-slate-800"></td>
                                    <td className="p-2 text-emerald-500"><Plus size={16}/></td>
                                    {orderedColumns.map(c => (
                                        <td key={c.column_name} className="p-2 border-r border-slate-800">
                                            {c.column_name === 'id' || c.column_name === 'created_at' ? <span className="text-slate-600 italic text-xs">Auto</span> : 
                                            c.data_type.includes('timestamp') || c.data_type.includes('date') ? 
                                                <input type="datetime-local" className="bg-slate-950 border border-slate-600 rounded p-1 text-sm text-white w-full" onChange={e => handleInputChange(c.column_name, e.target.value)} /> :
                                                <input className="bg-slate-950 border border-slate-600 rounded p-1 text-sm text-white w-full" onChange={e => handleInputChange(c.column_name, e.target.value)} />
                                            }
                                        </td>
                                    ))}
                                    <td className="p-2 sticky right-0 bg-slate-900 border-l border-slate-700"><button onClick={saveRow} className="text-emerald-400"><Save size={18}/></button> <button onClick={() => setIsAdding(false)} className="text-slate-400"><X size={18}/></button></td>
                                </tr>
                            )}
                            {rows.map(r => {
                                const isEditing = editingId === r[pk];
                                const isSelected = selectedIds.has(r[pk].toString());
                                return (
                                    <tr key={r[pk]} className={`hover:bg-slate-800/50 group ${isSelected ? 'bg-slate-800/80' : ''}`}>
                                        <td className="p-2 text-center border-r border-slate-800 bg-slate-900/30">
                                            <button onClick={() => toggleSelectRow(r[pk].toString())} className="text-slate-500 hover:text-white">
                                                {isSelected ? <CheckSquare size={14} className="text-emerald-500"/> : <Square size={14}/>}
                                            </button>
                                        </td>
                                        <td className="p-2 text-slate-600 text-xs text-center border-r border-slate-800">{r[pk]?.toString().substring(0,4)}</td>
                                        {orderedColumns.map(c => (
                                            <td key={c.column_name} className="p-2 text-sm text-slate-300 border-r border-slate-800 relative overflow-hidden">
                                                {isEditing && c.column_name !== pk && c.column_name !== 'created_at' ? (
                                                    c.data_type.includes('timestamp') ? 
                                                    <input type="datetime-local" defaultValue={formatDateForInput(r[c.column_name])} className="bg-slate-950 border border-slate-600 rounded p-1 w-full text-white" onChange={e => handleInputChange(c.column_name, e.target.value)} /> :
                                                    <input defaultValue={r[c.column_name]} className="bg-slate-950 border border-slate-600 rounded p-1 w-full text-white" onChange={e => handleInputChange(c.column_name, e.target.value)} />
                                                ) : (
                                                    <div className="truncate w-full block" title={String(r[c.column_name])}>
                                                        {typeof r[c.column_name] === 'object' ? JSON.stringify(r[c.column_name]) : String(r[c.column_name] ?? '')}
                                                    </div>
                                                )}
                                            </td>
                                        ))}
                                        <td className="p-2 flex gap-2 justify-center sticky right-0 bg-slate-900/90 group-hover:bg-slate-800 border-l border-slate-700 shadow-[-5px_0_10px_rgba(0,0,0,0.2)]">
                                            {isEditing ? (
                                                <><button onClick={saveRow} className="text-emerald-400"><Save size={16}/></button><button onClick={() => setEditingId(null)} className="text-slate-400"><X size={16}/></button></>
                                            ) : (
                                                <><button onClick={() => { setFormData({...r}); setEditingId(r[pk]); }} className="text-blue-400 hover:text-white"><Edit2 size={16}/></button><button onClick={() => deleteRow(r[pk])} className="text-red-400 hover:text-white"><Trash2 size={16}/></button></>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
              </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-900/30">
                <GripHorizontal size={48} className="mb-4 opacity-50" />
                <p>Selecione uma tabela para visualizar os dados.</p>
            </div>
          )}
      </div>
    </div>
  );
};

export default TableEditor;