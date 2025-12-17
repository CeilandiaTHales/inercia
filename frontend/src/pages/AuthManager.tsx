import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { User, ShieldAlert, Plus, X, ShieldCheck } from 'lucide-react';

const AuthManager = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  
  // Create User State
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });

  // Create Policy State
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [newPolicy, setNewPolicy] = useState({ schema: 'public', table: '', role: 'authenticated', command: 'SELECT', expression: 'true' });

  useEffect(() => {
    refresh();
  }, []);

  const refresh = () => {
      api.get('/users').then(setUsers).catch(console.error);
      api.get('/policies').then(setPolicies).catch(console.error);
      api.get('/tables').then(setTables).catch(console.error);
  };

  const createUser = async () => {
      try {
          await api.post('/auth/register', newUser);
          setShowUserModal(false);
          setNewUser({ email: '', password: '', role: 'user' });
          refresh();
      } catch (e: any) { alert(e.message); }
  };

  const deleteUser = async (id: string) => {
      if(!confirm('Delete user?')) return;
      try { await api.delete(`/users/${id}`); refresh(); } catch(e:any) { alert(e.message); }
  };

  const createPolicy = async () => {
      try {
          await api.post('/policies', newPolicy);
          setShowPolicyModal(false);
          refresh();
      } catch(e: any) { alert(e.message); }
  };

  const deletePolicy = async (p: any) => {
      if(!confirm('Delete policy?')) return;
      try { 
          await api.delete('/policies', { name: p.policyname, table: p.tablename, schema: p.schemaname }); 
          refresh(); 
      } catch(e:any) { alert(e.message); }
  };

  return (
    <div className="space-y-8">
      {/* Create User Modal */}
      {showUserModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="bg-slate-800 p-6 rounded border border-slate-600 w-96">
                  <h3 className="text-white font-bold mb-4">Add User</h3>
                  <input className="w-full mb-2 bg-slate-900 border border-slate-700 p-2 text-white rounded" placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                  <input className="w-full mb-2 bg-slate-900 border border-slate-700 p-2 text-white rounded" type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                  <select className="w-full mb-4 bg-slate-900 border border-slate-700 p-2 text-white rounded" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                  </select>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowUserModal(false)} className="text-slate-400">Cancel</button>
                      <button onClick={createUser} className="bg-emerald-600 text-white px-4 py-2 rounded">Create</button>
                  </div>
              </div>
          </div>
      )}

      {/* Create Policy Modal */}
      {showPolicyModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="bg-slate-800 p-6 rounded border border-slate-600 w-[500px]">
                  <h3 className="text-white font-bold mb-4">Create RLS Policy</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                      <select className="bg-slate-900 border border-slate-700 p-2 text-white rounded" value={newPolicy.table} onChange={e => setNewPolicy({...newPolicy, table: e.target.value})}>
                          <option value="">Select Table...</option>
                          {tables.map(t => <option key={t.table_name} value={t.table_name}>{t.table_name}</option>)}
                      </select>
                      <select className="bg-slate-900 border border-slate-700 p-2 text-white rounded" value={newPolicy.command} onChange={e => setNewPolicy({...newPolicy, command: e.target.value})}>
                          <option value="SELECT">SELECT (Read)</option>
                          <option value="INSERT">INSERT (Create)</option>
                          <option value="UPDATE">UPDATE</option>
                          <option value="DELETE">DELETE</option>
                          <option value="ALL">ALL</option>
                      </select>
                  </div>
                  <input className="w-full mb-2 bg-slate-900 border border-slate-700 p-2 text-white rounded" placeholder="Role (e.g. authenticated, anon)" value={newPolicy.role} onChange={e => setNewPolicy({...newPolicy, role: e.target.value})} />
                  <label className="text-xs text-slate-400">SQL Expression (e.g. auth.uid() = user_id)</label>
                  <input className="w-full mb-4 bg-slate-900 border border-slate-700 p-2 text-white rounded font-mono" placeholder="true" value={newPolicy.expression} onChange={e => setNewPolicy({...newPolicy, expression: e.target.value})} />
                  
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowPolicyModal(false)} className="text-slate-400">Cancel</button>
                      <button onClick={createPolicy} className="bg-emerald-600 text-white px-4 py-2 rounded">Add Policy</button>
                  </div>
              </div>
          </div>
      )}

      {/* Users Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <User className="text-blue-500" /> Users
            </h2>
            <button onClick={() => setShowUserModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-sm"><Plus size={16}/> Add User</button>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-900 text-slate-400 text-xs uppercase sticky top-0">
                    <tr>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Provider</th>
                        <th className="p-4">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-slate-300 text-sm">
                    {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-700/50">
                            <td className="p-4">{u.email}</td>
                            <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-purple-900 text-purple-200' : 'bg-slate-700'}`}>{u.role}</span></td>
                            <td className="p-4 text-slate-400">{u.provider}</td>
                            <td className="p-4">
                                <button onClick={() => deleteUser(u.id)} className="text-red-400 hover:text-white"><X size={16}/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* Policies Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-yellow-500" /> RLS Policies
            </h2>
            <button onClick={() => setShowPolicyModal(true)} className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1.5 rounded text-sm"><Plus size={16}/> Add Policy</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policies.map((p, i) => (
                <div key={i} className="bg-slate-800 border border-slate-700 p-4 rounded-lg relative group">
                    <button onClick={() => deletePolicy(p)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-slate-900 text-slate-400 text-xs px-2 py-1 rounded font-bold uppercase">{p.cmd}</span>
                        <span className="font-bold text-white">{p.tablename}</span>
                    </div>
                    <div className="text-xs text-emerald-400 font-mono mb-1">{p.policyname}</div>
                    <div className="text-sm text-slate-300">Target: <span className="text-white font-bold">{p.roles.join(', ')}</span></div>
                    {/* Parse simple expression if possible or just show */}
                    <div className="mt-2 text-xs bg-slate-950 p-2 rounded font-mono text-slate-500 truncate">{String(p.qual || p.with_check || 'true')}</div>
                </div>
            ))}
            {policies.length === 0 && <div className="col-span-2 text-center text-slate-500 py-8">No policies defined. Your data is likely public or locked depending on default RLS settings.</div>}
        </div>
      </div>
    </div>
  );
};

export default AuthManager;