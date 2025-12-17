import React, { useState } from 'react';
import { api } from '../api';
import { Plus, Trash2, Save } from 'lucide-react';

interface Column {
    name: string;
    type: string;
    nullable: boolean;
}

const TableBuilder = () => {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<Column[]>([
    { name: 'name', type: 'text', nullable: false }
  ]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const addColumn = () => {
    setColumns([...columns, { name: '', type: 'text', nullable: true }]);
  };

  const removeColumn = (idx: number) => {
    setColumns(columns.filter((_, i) => i !== idx));
  };

  const updateColumn = (idx: number, field: keyof Column, value: any) => {
    const newCols = [...columns];
    (newCols[idx] as any)[field] = value;
    setColumns(newCols);
  };

  const handleCreate = async () => {
    if (!tableName) return setMsg({ type: 'error', text: 'Table name is required' });
    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
        await api.post('/tables/create', { name: tableName, columns });
        setMsg({ type: 'success', text: `Table "${tableName}" created successfully!` });
        setTableName('');
        setColumns([{ name: 'name', type: 'text', nullable: false }]);
    } catch (e: any) {
        setMsg({ type: 'error', text: e.message || 'Failed to create table' });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Table Builder</h1>
        <p className="text-slate-400 mb-8">Create new database tables without writing SQL.</p>

        {msg.text && (
            <div className={`p-4 rounded mb-6 ${msg.type === 'error' ? 'bg-red-900/20 text-red-400' : 'bg-emerald-900/20 text-emerald-400'}`}>
                {msg.text}
            </div>
        )}

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-6">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Table Name</label>
                <input 
                    type="text" 
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. products"
                />
            </div>

            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-400">Columns</label>
                    <span className="text-xs text-slate-500">id (uuid) and created_at are added automatically</span>
                </div>
                
                <div className="space-y-2">
                    {columns.map((col, idx) => (
                        <div key={idx} className="flex gap-4 items-start">
                            <input 
                                type="text" 
                                placeholder="Column Name"
                                value={col.name}
                                onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 focus:outline-none text-sm"
                            />
                            <select 
                                value={col.type}
                                onChange={(e) => updateColumn(idx, 'type', e.target.value)}
                                className="w-32 bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 focus:outline-none text-sm"
                            >
                                <option value="text">Text</option>
                                <option value="integer">Integer</option>
                                <option value="boolean">Boolean</option>
                                <option value="timestamp">Timestamp</option>
                                <option value="jsonb">JSON</option>
                                <option value="numeric">Decimal</option>
                            </select>
                            <div className="flex items-center h-10 px-2 bg-slate-900 border border-slate-600 rounded">
                                <input 
                                    type="checkbox"
                                    checked={col.nullable}
                                    onChange={(e) => updateColumn(idx, 'nullable', e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="text-xs text-slate-400">Nullable</span>
                            </div>
                            <button onClick={() => removeColumn(idx)} className="p-2 text-slate-500 hover:text-red-400">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
                
                <button onClick={addColumn} className="mt-4 flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300">
                    <Plus size={16} /> Add Column
                </button>
            </div>

            <div className="pt-4 border-t border-slate-700">
                <button 
                    onClick={handleCreate} 
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded flex items-center gap-2 disabled:opacity-50"
                >
                    <Save size={18} />
                    {loading ? 'Creating...' : 'Create Table'}
                </button>
            </div>
        </div>
    </div>
  );
};

export default TableBuilder;