import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { User, ShieldAlert } from 'lucide-react';

const AuthManager = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);

  useEffect(() => {
    api.get('/users').then(setUsers).catch(console.error);
    api.get('/policies').then(setPolicies).catch(console.error);
  }, []);

  return (
    <div className="space-y-8">
      {/* Users Section */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <User className="text-blue-500" /> Users (Top 100)
        </h2>
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
                    <tr>
                        <th className="p-4">ID</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Provider</th>
                        <th className="p-4">Created</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-slate-300 text-sm">
                    {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-700/50">
                            <td className="p-4 font-mono text-xs text-slate-500">{u.id}</td>
                            <td className="p-4">{u.email}</td>
                            <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-purple-900 text-purple-200' : 'bg-slate-700'}`}>{u.role}</span></td>
                            <td className="p-4 text-slate-400">{u.provider}</td>
                            <td className="p-4 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* Policies Section */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <ShieldAlert className="text-yellow-500" /> RLS Policies
        </h2>
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            {policies.length === 0 ? (
                <div className="p-6 text-slate-500 text-center">No active RLS policies found in pg_policies.</div>
            ) : (
                <table className="w-full text-left">
                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
                        <tr>
                            <th className="p-4">Schema</th>
                            <th className="p-4">Table</th>
                            <th className="p-4">Policy Name</th>
                            <th className="p-4">Command</th>
                            <th className="p-4">Roles</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700 text-slate-300 text-sm">
                        {policies.map((p, i) => (
                            <tr key={i} className="hover:bg-slate-700/50">
                                <td className="p-4 text-slate-400">{p.schemaname}</td>
                                <td className="p-4 font-bold">{p.tablename}</td>
                                <td className="p-4 text-emerald-400">{p.policyname}</td>
                                <td className="p-4 font-mono text-xs">{p.cmd}</td>
                                <td className="p-4 text-xs">{p.roles.join(', ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  );
};

export default AuthManager;
