import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Plus, Trash2, Edit2, Save, X, Search } from 'lucide-react';
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

  // Editing state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    api.get('/tables').then(setTables).catch(console.error);
  }, []);

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

  const handleInputChange = (colName: string, value: any) => {
      setFormData({ ...formData, [colName]: value });
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
            // Filter out keys that shouldn't be updated (like created_at if not intended, but usually backend handles readonly)
            // For now, send everything in formData
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

  const filteredTables = tables.filter(t => 
      t.table_name.toLowerCase().includes(filter.toLowerCase()) || 
      t.table_schema.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex h-full gap-6">
      {/* Sidebar Table List */}
      <div className="w-64 flex-shrink-0 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-850 border-b border-slate-700 space-y-2">
            <h2 className="font-bold text-white">{t.browser.tables}</h2>
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
                    className={`w-full text-left px-3 py-2 rounded mb-1 text-sm ${selectedTable?.table === t.table_name ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                    <span className="text-slate-500 text-xs mr-2">{t.table_schema}</span>
                    {t.table_name}
                </button>
            ))}
        </div>
      </div>

      {/* Data View */}
      <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 flex flex-col overflow-hidden relative">
        {selectedTable ? (
            <>
                <div className="p-4 border-b border-slate-700 bg-slate-850 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="font-bold text-white text-lg">{selectedTable.schema}.{selectedTable.table}</h2>
                        <span className="text-slate-500 text-sm">{rows.length} {t.browser.rows}</span>
                    </div>
                    {!isAdding && !editingId && (
                        <button onClick={startAdd} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-sm transition-colors">
                            <Plus size={16} /> {t.browser.add_row}
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-auto p-0">
                    {loading ? (
                        <div className="p-10 text-center text-slate-500">{t.browser.loading}</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 w-16 bg-slate-900 border-b border-slate-700"></th>
                                    {columns.map(col => (
                                        <th key={col.column_name} className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap">
                                            {col.column_name} 
                                            <span className="ml-1 text-[10px] text-slate-600 normal-case">({col.data_type})</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {isAdding && (
                                    <tr className="bg-emerald-900/20">
                                        <td className="p-2 text-center">
                                            <div className="flex gap-1 justify-center">
                                                <button onClick={saveRow} className="text-emerald-400 hover:text-emerald-300 p-1"><Save size={16} /></button>
                                                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-white p-1"><X size={16} /></button>
                                            </div>
                                        </td>
                                        {columns.map(col => (
                                            <td key={col.column_name} className="p-2">
                                                {col.column_name === 'id' || col.column_name === 'created_at' ? (
                                                     <span className="text-slate-500 italic text-xs">Auto</span>
                                                ) : (
                                                    <input 
                                                        className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500"
                                                        value={formData[col.column_name] || ''}
                                                        onChange={e => handleInputChange(col.column_name, e.target.value)}
                                                    />
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                )}

                                {rows.map((row) => {
                                    const isEditing = editingId === row[pk];
                                    return (
                                        <tr key={row[pk]} className={isEditing ? 'bg-blue-900/20' : 'hover:bg-slate-700/50'}>
                                            <td className="p-2 w-16 whitespace-nowrap">
                                                {isEditing ? (
                                                    <div className="flex gap-1 justify-center">
                                                        <button onClick={saveRow} className="text-emerald-400 hover:text-emerald-300 p-1"><Save size={16} /></button>
                                                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-white p-1"><X size={16} /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => startEdit(row)} className="text-blue-400 hover:text-blue-300 p-1"><Edit2 size={16} /></button>
                                                        <button onClick={() => deleteRow(row[pk])} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={16} /></button>
                                                    </div>
                                                )}
                                            </td>
                                            {columns.map(col => (
                                                <td key={col.column_name} className="p-3 text-sm text-slate-300 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">
                                                    {isEditing && col.column_name !== pk && col.column_name !== 'created_at' ? (
                                                        <input 
                                                            className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                                            value={formData[col.column_name] !== undefined ? formData[col.column_name] : row[col.column_name]}
                                                            onChange={e => handleInputChange(col.column_name, e.target.value)}
                                                        />
                                                    ) : (
                                                        <span>
                                                            {typeof row[col.column_name] === 'object' 
                                                                ? JSON.stringify(row[col.column_name]) 
                                                                : String(row[col.column_name] ?? '')}
                                                        </span>
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                                {rows.length === 0 && !isAdding && (
                                     <tr><td colSpan={columns.length + 1} className="p-8 text-center text-slate-500">{t.browser.no_data}</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </>
        ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
                {t.browser.select_table}
            </div>
        )}
      </div>
    </div>
  );
};

export default TableEditor;