import React, { useEffect, useState } from 'react';
import { api } from '../api';

const TableEditor = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/tables').then(setTables).catch(console.error);
  }, []);

  const fetchRows = async (schema: string, table: string) => {
    setLoading(true);
    setSelectedTable({ schema, table });
    try {
        const data = await api.get(`/tables/${schema}/${table}/data`);
        setRows(data);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex h-full gap-6">
      {/* Sidebar Table List */}
      <div className="w-64 flex-shrink-0 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-4 bg-slate-850 border-b border-slate-700">
            <h2 className="font-bold text-white">Tables</h2>
        </div>
        <div className="p-2 overflow-y-auto h-full">
            {tables.map((t, idx) => (
                <button
                    key={idx}
                    onClick={() => fetchRows(t.table_schema, t.table_name)}
                    className={`w-full text-left px-3 py-2 rounded mb-1 text-sm ${selectedTable?.table === t.table_name ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                    <span className="text-slate-500 text-xs mr-2">{t.table_schema}</span>
                    {t.table_name}
                </button>
            ))}
        </div>
      </div>

      {/* Data View */}
      <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 flex flex-col overflow-hidden">
        {selectedTable ? (
            <>
                <div className="p-4 border-b border-slate-700 bg-slate-850 flex justify-between items-center">
                    <h2 className="font-bold text-white text-lg">{selectedTable.schema}.{selectedTable.table}</h2>
                    <span className="text-slate-500 text-sm">{rows.length} rows</span>
                </div>
                <div className="flex-1 overflow-auto p-0">
                    {loading ? (
                        <div className="p-10 text-center text-slate-500">Loading data...</div>
                    ) : rows.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900 sticky top-0">
                                <tr>
                                    {Object.keys(rows[0]).map(key => (
                                        <th key={key} className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                                            {key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {rows.map((row, i) => (
                                    <tr key={i} className="hover:bg-slate-700/50">
                                        {Object.values(row).map((val: any, j) => (
                                            <td key={j} className="p-3 text-sm text-slate-300 whitespace-nowrap">
                                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-10 text-center text-slate-500">No data found in this table.</div>
                    )}
                </div>
            </>
        ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
                Select a table to view data
            </div>
        )}
      </div>
    </div>
  );
};

export default TableEditor;
