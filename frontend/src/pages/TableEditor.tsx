import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { Plus, Trash2, Edit2, Save, X, Search, Calendar, Upload, FilePlus, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const TableEditor = () => {
  const { t } = useLanguage();
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [pk, setPk] = useState<string>('id');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

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

  useEffect(() => { refreshTables(); }, []);
  const refreshTables = () => api.get('/tables').then(setTables).catch(console.error);

  const fetchTableData = async (schema: string, table: string) => {
    setLoading(true);
    setSelectedTable({ schema, table });
    setIsAdding(false);
    setEditingId(null);
    try {
        const meta = await api.get(`/tables/${schema}/${table}/meta`);
        setColumns(meta);
        const res = await api.get(`/tables/${schema}/${table}/data`);
        setRows(res.data);
        setPk(res.pk);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
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

          if (!targetTable) return alert("Table name required");

          await api.post(`/import/csv`, { 
              schema: targetSchema, 
              table: targetTable, 
              rows: rowsToInsert,
              createTable: csvMode === 'new'
          });

          setShowImportModal(false);
          setCsvContent('');
          setNewTableName('');
          refreshTables();
          if (csvMode === 'existing') fetchTableData(targetSchema, targetTable);
          alert('Import Successful!');
      } catch (e: any) { alert("Import failed: " + e.message); }
  };

  const createManualTable = async () => {
      try {
          await api.post('/tables/create', { name: manualTableName, columns: manualCols });
          setShowCreateModal(false);
          setManualTableName('');
          setManualCols([{ name: 'name', type: 'text', nullable: true }]);
          refreshTables();
      } catch(e: any) { alert(e.message); }
  };

  // Helper for Date Inputs
  const formatDateForInput = (isoString: string) => {
      if (!isoString) return '';
      // Create date object and adjust for timezone offset to display correct local time in input
      const date = new Date(isoString);
      const offset = date.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
      return localISOTime;
  };

  const handleInputChange = (colName: string, value: any) => {
      setFormData({ ...formData, [colName]: value });
  };

  const saveRow = async () => {
      const { schema, table } = selectedTable;
      try {
          if (isAdding) {
              const newRow = await api.post(`/tables/${schema}/${table}/data`, formData);
              setRows([...rows, newRow]);
              setIsAdding(false);
          } else if (editingId) {
              const updated = await api.put(`/tables/${schema}/${table}/data/${editingId}?pk=${pk}`, formData);
              setRows(rows.map(r => r[pk] === editingId ? updated : r));
              setEditingId(null);
          }
      } catch(e:any) { alert(e.message); }
  };

  const deleteRow = async (id: string) => {
      if(!confirm(t.browser.confirm_delete)) return;
      const { schema, table } = selectedTable;
      await api.delete(`/tables/${schema}/${table}/data/${id}?pk=${pk}`);
      setRows(rows.filter(r => r[pk] !== id));
  };

  return (
    <div className="flex h-full gap-6">
       {/* Import Modal */}
       {showImportModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-lg w-full shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4">Importar CSV</h2>
                
                <div className="flex gap-4 mb-4">
                    <button onClick={() => setCsvMode('existing')} className={`px-4 py-2 rounded ${csvMode === 'existing' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Tabela Existente</button>
                    <button onClick={() => setCsvMode('new')} className={`px-4 py-2 rounded ${csvMode === 'new' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Criar Nova Tabela</button>
                </div>

                {csvMode === 'new' && (
                    <input 
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white mb-4"
                        placeholder="Nome da Nova Tabela (ex: clientes)"
                        value={newTableName}
                        onChange={e => setNewTableName(e.target.value)}
                    />
                )}

                <textarea 
                    className="w-full h-40 bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono text-xs mb-4"
                    placeholder="nome,idade,ativo&#10;João,30,true"
                    value={csvContent}
                    onChange={e => setCsvContent(e.target.value)}
                />
                 <div className="flex justify-end gap-2">
                    <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white">Cancelar</button>
                    <button onClick={handleImport} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">Processar</button>
                </div>
            </div>
          </div>
      )}

      {/* Manual Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-lg w-full">
                <h2 className="text-xl font-bold text-white mb-4">Criar Tabela Manualmente</h2>
                <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white mb-4" placeholder="Nome da Tabela" value={manualTableName} onChange={e => setManualTableName(e.target.value)} />
                <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                    {manualCols.map((c, i) => (
                        <div key={i} className="flex gap-2">
                            <input className="bg-slate-950 border border-slate-700 rounded p-1 text-white flex-1" placeholder="Coluna" value={c.name} onChange={e => {const n = [...manualCols]; n[i].name = e.target.value; setManualCols(n)}} />
                            <select className="bg-slate-950 border border-slate-700 rounded p-1 text-white text-xs" value={c.type} onChange={e => {const n = [...manualCols]; n[i].type = e.target.value; setManualCols(n)}}>
                                <option value="text">Text</option>
                                <option value="varchar(255)">Varchar</option>
                                <option value="integer">Integer</option>
                                <option value="boolean">Boolean</option>
                                <option value="timestamp">Timestamp</option>
                                <option value="date">Date</option>
                                <option value="jsonb">JSON</option>
                                <option value="uuid">UUID</option>
                                <option value="numeric">Numeric</option>
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

      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 bg-slate-800 rounded-lg border border-slate-700 flex flex-col">
          <div className="p-4 bg-slate-900 border-b border-slate-700">
             <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold text-white">Tabelas</h2>
                <div className="flex gap-1">
                    <button onClick={() => { setCsvMode('new'); setShowImportModal(true); }} className="text-blue-400 hover:text-white" title="Importar CSV"><Upload size={18}/></button>
                    <button onClick={() => setShowCreateModal(true)} className="text-emerald-400 hover:text-white" title="Nova Tabela"><FilePlus size={18}/></button>
                </div>
             </div>
             <div className="relative">
                <Search size={14} className="absolute left-2 top-2.5 text-slate-500"/>
                <input 
                    className="w-full bg-slate-950 border border-slate-700 rounded py-1 pl-8 pr-2 text-xs text-white focus:outline-none focus:border-emerald-500" 
                    placeholder="Buscar..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
             {tables.filter(t => t.table_name.includes(filter)).map(t => (
                 <button 
                    key={t.table_name} 
                    onClick={() => fetchTableData(t.table_schema, t.table_name)}
                    className={`w-full text-left px-3 py-2 rounded mb-1 text-sm flex items-center gap-2 ${selectedTable?.table === t.table_name ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                 >
                    <span className="text-[10px] bg-slate-900 px-1 rounded text-slate-500">{t.table_schema.slice(0,3)}</span>
                    {t.table_name}
                 </button>
             ))}
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 flex flex-col overflow-hidden">
          {selectedTable ? (
              <>
                <div className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">{selectedTable.table} <span className="text-slate-500 text-sm">({rows.length} rows)</span></h2>
                    <div className="flex gap-2">
                        <button onClick={() => {setCsvMode('existing'); setShowImportModal(true);}} className="bg-slate-700 text-white px-3 py-1 rounded text-sm flex items-center gap-2"><Upload size={14}/> CSV</button>
                        {!isAdding && !editingId && <button onClick={() => {setFormData({}); setIsAdding(true);}} className="bg-emerald-600 text-white px-3 py-1 rounded text-sm flex items-center gap-2"><Plus size={14}/> Novo</button>}
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900 sticky top-0 shadow">
                            <tr>
                                <th className="p-3 border-b border-slate-700 w-10"></th>
                                {columns.map(c => <th key={c.column_name} className="p-3 border-b border-slate-700 text-xs text-slate-400 uppercase font-bold">{c.column_name} <span className="text-[9px] font-normal lowercase ml-1 text-slate-600">{c.data_type}</span></th>)}
                                <th className="p-3 border-b border-slate-700 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {isAdding && (
                                <tr className="bg-emerald-900/10">
                                    <td className="p-3 text-emerald-500"><Plus size={16}/></td>
                                    {columns.map(c => (
                                        <td key={c.column_name} className="p-2">
                                            {c.column_name === 'id' || c.column_name === 'created_at' ? <span className="text-slate-600 italic text-xs">Auto</span> : 
                                            c.data_type.includes('timestamp') || c.data_type.includes('date') ? 
                                                <input type="datetime-local" className="bg-slate-950 border border-slate-600 rounded p-1 text-sm text-white w-full" onChange={e => handleInputChange(c.column_name, e.target.value)} /> :
                                                <input className="bg-slate-950 border border-slate-600 rounded p-1 text-sm text-white w-full" onChange={e => handleInputChange(c.column_name, e.target.value)} />
                                            }
                                        </td>
                                    ))}
                                    <td className="p-2"><button onClick={saveRow} className="text-emerald-400"><Save size={18}/></button> <button onClick={() => setIsAdding(false)} className="text-slate-400"><X size={18}/></button></td>
                                </tr>
                            )}
                            {rows.map(r => {
                                const isEditing = editingId === r[pk];
                                return (
                                    <tr key={r[pk]} className="hover:bg-slate-700/30">
                                        <td className="p-3 text-slate-600 text-xs">{r[pk]?.toString().substring(0,4)}</td>
                                        {columns.map(c => (
                                            <td key={c.column_name} className="p-3 text-sm text-slate-300">
                                                {isEditing && c.column_name !== pk && c.column_name !== 'created_at' ? (
                                                    c.data_type.includes('timestamp') ? 
                                                    <input type="datetime-local" defaultValue={formatDateForInput(r[c.column_name])} className="bg-slate-950 border border-slate-600 rounded p-1 w-full text-white" onChange={e => handleInputChange(c.column_name, e.target.value)} /> :
                                                    <input defaultValue={r[c.column_name]} className="bg-slate-950 border border-slate-600 rounded p-1 w-full text-white" onChange={e => handleInputChange(c.column_name, e.target.value)} />
                                                ) : (
                                                    <span className="truncate block max-w-xs">{typeof r[c.column_name] === 'object' ? JSON.stringify(r[c.column_name]) : String(r[c.column_name] ?? '')}</span>
                                                )}
                                            </td>
                                        ))}
                                        <td className="p-3 flex gap-2">
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
          ) : <div className="flex items-center justify-center h-full text-slate-500"><p>Selecione uma tabela</p></div>}
      </div>
    </div>
  );
};

export default TableEditor;