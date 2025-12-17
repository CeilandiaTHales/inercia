import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { Plus, Trash2, Edit2, Save, X, Search, GripVertical, Calendar, Upload, FilePlus, ChevronRight } from 'lucide-react';
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

  // Column Resizing State
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingCol = useRef<string | null>(null);

  // Interaction State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  
  // CSV / Create State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');

  useEffect(() => {
    refreshTables();
  }, []);

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
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, colName: string) => {
      resizingCol.current = colName;
      const startX = e.clientX;
      const startWidth = colWidths[colName] || 150;

      const onMouseMove = (moveEvent: MouseEvent) => {
          if (resizingCol.current) {
              const diff = moveEvent.clientX - startX;
              setColWidths(prev => ({ ...prev, [colName]: Math.max(50, startWidth + diff) }));
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

  const handleInputChange = (colName: string, value: any) => {
      setFormData({ ...formData, [colName]: value });
  };

  const setNow = (colName: string) => {
      // Format: YYYY-MM-DDTHH:mm (local)
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      handleInputChange(colName, now.toISOString().slice(0, 16));
  };

  const startAdd = () => {
      setFormData({});
      setIsAdding(true);
      setEditingId(null);
  };

  const startEdit = (row: any) => {
      setFormData({ ...row });
      setEditingId(row[pk]);
      setIsAdding(false);
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
    } catch (e: any) {
        alert("Error saving: " + e.message);
    }
  };

  const deleteRow = async (id: string) => {
      if (!window.confirm(t.browser.confirm_delete)) return;
      const { schema, table } = selectedTable;
      try {
          await api.delete(`/tables/${schema}/${table}/data/${id}?pk=${pk}`, {});
          setRows(rows.filter(r => r[pk] !== id));
      } catch (e: any) {
          alert("Error deleting: " + e.message);
      }
  };

  const handleCopy = (txt: string) => {
      navigator.clipboard.writeText(txt);
      // Optional: Toast notification
  };

  const handleImport = async () => {
      if (!csvContent || !selectedTable) return;
      try {
          // Simple CSV Parse
          const lines = csvContent.trim().split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          const rowsToInsert = lines.slice(1).map(line => {
              const values = line.split(',');
              const obj: any = {};
              headers.forEach((h, i) => {
                  if (values[i] !== undefined) obj[h] = values[i].trim();
              });
              return obj;
          });

          await api.post(`/tables/${selectedTable.schema}/${selectedTable.table}/import`, { rows: rowsToInsert });
          setShowImportModal(false);
          setCsvContent('');
          fetchTableData(selectedTable.schema, selectedTable.table);
          alert('Import successful!');
      } catch (e: any) {
          alert("Import failed: " + e.message);
      }
  };

  // --- Create Table Logic ---
  const [newTableName, setNewTableName] = useState('');
  const [newCols, setNewCols] = useState([{ name: 'name', type: 'text', nullable: true }]);
  const createTable = async () => {
      try {
        await api.post('/tables/create', { name: newTableName, columns: newCols });
        setShowCreateModal(false);
        setNewTableName('');
        setNewCols([{ name: 'name', type: 'text', nullable: true }]);
        refreshTables();
      } catch(e: any) { alert(e.message); }
  }

  const filteredTables = tables.filter(t => 
      t.table_name.toLowerCase().includes(filter.toLowerCase()) || 
      t.table_schema.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex h-full gap-6">
      {/* Create Table Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-lg w-full">
                <h2 className="text-xl font-bold text-white mb-4">Create New Table</h2>
                <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mb-4" placeholder="Table Name" value={newTableName} onChange={e => setNewTableName(e.target.value)} />
                <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                    {newCols.map((c, i) => (
                        <div key={i} className="flex gap-2">
                            <input className="bg-slate-900 border border-slate-700 rounded p-1 text-white flex-1" placeholder="Col Name" value={c.name} onChange={e => {const n = [...newCols]; n[i].name = e.target.value; setNewCols(n)}} />
                            <select className="bg-slate-900 border border-slate-700 rounded p-1 text-white" value={c.type} onChange={e => {const n = [...newCols]; n[i].type = e.target.value; setNewCols(n)}}>
                                <option value="text">Text</option><option value="integer">Int</option><option value="boolean">Bool</option><option value="timestamp">Date</option>
                            </select>
                            <button onClick={() => setNewCols(newCols.filter((_, idx) => idx !== i))} className="text-red-400"><X size={16}/></button>
                        </div>
                    ))}
                    <button onClick={() => setNewCols([...newCols, {name:'', type:'text', nullable:true}])} className="text-emerald-400 text-sm flex items-center gap-1"><Plus size={14}/> Add Col</button>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setShowCreateModal(false)} className="text-slate-400">Cancel</button>
                    <button onClick={createTable} className="bg-emerald-600 text-white px-4 py-2 rounded">Create</button>
                </div>
            </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-lg w-full">
                <h2 className="text-xl font-bold text-white mb-4">Import CSV to {selectedTable?.table}</h2>
                <p className="text-xs text-slate-400 mb-2">First row must be headers matching column names.</p>
                <textarea 
                    className="w-full h-40 bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono text-xs mb-4"
                    placeholder="name,price&#10;Widget,99.99"
                    value={csvContent}
                    onChange={e => setCsvContent(e.target.value)}
                />
                 <div className="flex justify-end gap-2">
                    <button onClick={() => setShowImportModal(false)} className="text-slate-400">Cancel</button>
                    <button onClick={handleImport} className="bg-blue-600 text-white px-4 py-2 rounded">Import</button>
                </div>
            </div>
          </div>
      )}

      {/* Sidebar Table List */}
      <div className="w-64 flex-shrink-0 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-850 border-b border-slate-700 space-y-3">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-white">{t.browser.tables}</h2>
                <button onClick={() => setShowCreateModal(true)} className="text-emerald-400 hover:text-emerald-300" title="Create Table">
                    <FilePlus size={18} />
                </button>
            </div>
            <div className="relative">
                <Search size={14} className="absolute left-2 top-2.5 text-slate-500"/>
                <input 
                    className="w-full bg-slate-900 border border-slate-700 rounded py-1 pl-8 pr-2 text-xs text-white focus:outline-none focus:border-emerald-500" 
                    placeholder="Search..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            </div>
        </div>
        <div className="p-2 overflow-y-auto flex-1">
            {filteredTables.map((t, idx) => (
                <button
                    key={idx}
                    onClick={() => fetchTableData(t.table_schema, t.table_name)}
                    className={`w-full text-left px-3 py-2 rounded mb-1 text-sm flex items-center gap-2 group ${selectedTable?.table === t.table_name ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                    <span className={`text-[10px] uppercase font-bold px-1 rounded ${t.table_schema === 'public' ? 'bg-slate-900 text-slate-500' : 'bg-purple-900 text-purple-200'}`}>{t.table_schema.slice(0,3)}</span>
                    <span className="truncate">{t.table_name}</span>
                </button>
            ))}
        </div>
      </div>

      {/* Data View */}
      <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 flex flex-col overflow-hidden relative">
        {selectedTable ? (
            <>
                <div className="p-4 border-b border-slate-700 bg-slate-850 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="font-bold text-white text-lg">{selectedTable.schema}.{selectedTable.table}</h2>
                        <span className="text-slate-500 text-sm border-l border-slate-700 pl-4">{rows.length} {t.browser.rows}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm transition-colors">
                            <Upload size={16} /> Import CSV
                        </button>
                        {!isAdding && !editingId && (
                            <button onClick={startAdd} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-sm transition-colors">
                                <Plus size={16} /> {t.browser.add_row}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-0 relative">
                    {loading ? (
                        <div className="p-10 text-center text-slate-500">{t.browser.loading}</div>
                    ) : (
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="bg-slate-900 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-2 w-10 bg-slate-900 border-b border-slate-700"></th>
                                    {columns.map(col => (
                                        <th 
                                            key={col.column_name} 
                                            className="p-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 relative group select-none"
                                            style={{ width: colWidths[col.column_name] || 150 }}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="truncate" title={col.column_name}>{col.column_name}</span>
                                                <span className="text-[9px] text-slate-600 bg-slate-800 px-1 rounded">{col.data_type}</span>
                                            </div>
                                            <div 
                                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-500"
                                                onMouseDown={(e) => handleResizeStart(e, col.column_name)}
                                            />
                                        </th>
                                    ))}
                                    <th className="p-2 w-20 bg-slate-900 border-b border-slate-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {isAdding && (
                                    <tr className="bg-emerald-900/20">
                                        <td className="p-2 text-center text-emerald-500"><Plus size={14}/></td>
                                        {columns.map(col => (
                                            <td key={col.column_name} className="p-2 border-r border-slate-700/50">
                                                {col.column_name === 'id' || col.column_name === 'created_at' ? (
                                                     <span className="text-slate-500 italic text-xs">Auto</span>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <input 
                                                            type={col.data_type.includes('timestamp') ? 'datetime-local' : 'text'}
                                                            className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500"
                                                            value={formData[col.column_name] || ''}
                                                            onChange={e => handleInputChange(col.column_name, e.target.value)}
                                                        />
                                                        {col.data_type.includes('timestamp') && (
                                                            <button onClick={() => setNow(col.column_name)} className="p-1 bg-slate-700 rounded hover:bg-emerald-600" title="Set Now"><Calendar size={12}/></button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        ))}
                                        <td className="p-2">
                                            <div className="flex gap-1">
                                                <button onClick={saveRow} className="text-emerald-400 hover:text-emerald-300 p-1 bg-slate-900 rounded"><Save size={16} /></button>
                                                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-white p-1 bg-slate-900 rounded"><X size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {rows.map((row) => {
                                    const isEditing = editingId === row[pk];
                                    return (
                                        <tr key={row[pk]} className={isEditing ? 'bg-blue-900/20' : 'hover:bg-slate-700/50 group'}>
                                            <td className="p-2 text-center text-slate-600 text-[10px]">{row[pk]?.toString().slice(0,4)}..</td>
                                            {columns.map(col => (
                                                <td 
                                                    key={col.column_name} 
                                                    className="p-2 text-sm text-slate-300 border-r border-slate-700/30 overflow-hidden text-ellipsis whitespace-nowrap relative"
                                                    title={String(row[col.column_name])}
                                                    onClick={() => !isEditing && handleCopy(String(row[col.column_name]))}
                                                    onDoubleClick={() => startEdit(row)}
                                                >
                                                    {isEditing && col.column_name !== pk && col.column_name !== 'created_at' ? (
                                                        <div className="flex items-center gap-1">
                                                             <input 
                                                                type={col.data_type.includes('timestamp') ? 'datetime-local' : 'text'}
                                                                className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                                                value={formData[col.column_name] !== undefined ? formData[col.column_name] : row[col.column_name]}
                                                                onChange={e => handleInputChange(col.column_name, e.target.value)}
                                                            />
                                                            {col.data_type.includes('timestamp') && (
                                                                <button onClick={() => setNow(col.column_name)} className="p-1 bg-slate-700 rounded hover:bg-blue-600" title="Set Now"><Calendar size={12}/></button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="cursor-pointer hover:text-white">
                                                            {typeof row[col.column_name] === 'object' 
                                                                ? JSON.stringify(row[col.column_name]) 
                                                                : String(row[col.column_name] ?? '')}
                                                        </span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="p-2">
                                                {isEditing ? (
                                                    <div className="flex gap-1">
                                                        <button onClick={saveRow} className="text-emerald-400 hover:text-emerald-300 p-1"><Save size={16} /></button>
                                                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-white p-1"><X size={16} /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => startEdit(row)} className="text-blue-400 hover:text-blue-300 p-1"><Edit2 size={16} /></button>
                                                        <button onClick={() => deleteRow(row[pk])} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={16} /></button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <ChevronRight size={48} className="mb-4 opacity-50" />
                <p>Select a table to manage data</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default TableEditor;