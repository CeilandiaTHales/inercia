import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { User, ShieldCheck, Plus, X, Trash2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const AuthManager = () => {
  const { t } = useLanguage();
  const [users, setUsers] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  
  // UI States
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  
  // Form Data
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });
  const [newPolicy, setNewPolicy] = useState({ 
      table: '', 
      action: 'SELECT', // SELECT, INSERT, UPDATE, DELETE, ALL
      role: 'authenticated', // authenticated, anon, public
      condition: 'true' 
  });

  useEffect(() => { refresh(); }, []);

  const refresh = () => {
      api.get('/users').then(setUsers).catch(console.error);
      api.get('/policies').then(setPolicies).catch(console.error);
      api.get('/tables').then(setTables).catch(console.error);
  };

  const createUser = async () => {
      try { await api.post('/auth/register', newUser); setShowUserModal(false); refresh(); } catch(e:any){alert(e.message);}
  };

  const createPolicy = async () => {
      try {
          await api.post('/policies', {
              schema: 'public', // Default to public for simplicity
              table: newPolicy.table,
              command: newPolicy.action,
              role: newPolicy.role,
              expression: newPolicy.condition
          });
          setShowPolicyModal(false);
          refresh();
      } catch(e:any){alert(e.message);}
  };

  const deletePolicy = async (p:any) => {
      if(!confirm("Deletar regra?")) return;
      await api.delete('/policies', { name: p.policyname, table: p.tablename, schema: p.schemaname });
      refresh();
  };

  return (
    <div className="space-y-8">
        {/* Policy Modal */}
        {showPolicyModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-lg w-full shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-4">Nova Regra de Segurança</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-slate-400 text-sm mb-1">Na Tabela:</label>
                            <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newPolicy.table} onChange={e => setNewPolicy({...newPolicy, table: e.target.value})}>
                                <option value="">Selecione...</option>
                                {tables.map(t => <option key={t.table_name} value={t.table_name}>{t.table_name}</option>)}
                            </select>
                        </div>
                        
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-slate-400 text-sm mb-1">Quem pode:</label>
                                <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newPolicy.role} onChange={e => setNewPolicy({...newPolicy, role: e.target.value})}>
                                    <option value="authenticated">Usuário Logado</option>
                                    <option value="anon">Visitante (Anon)</option>
                                    <option value="public">Todos (Public)</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-slate-400 text-sm mb-1">Fazer o que:</label>
                                <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newPolicy.action} onChange={e => setNewPolicy({...newPolicy, action: e.target.value})}>
                                    <option value="SELECT">Ler (Select)</option>
                                    <option value="INSERT">Criar (Insert)</option>
                                    <option value="UPDATE">Editar (Update)</option>
                                    <option value="DELETE">Excluir (Delete)</option>
                                    <option value="ALL">Tudo (All)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-slate-400 text-sm mb-1">Se a condição for verdadeira (SQL):</label>
                            <input 
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-emerald-400 font-mono text-sm" 
                                value={newPolicy.condition} 
                                onChange={e => setNewPolicy({...newPolicy, condition: e.target.value})}
                                placeholder="ex: auth.uid() = user_id" 
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Use 'true' para permitir sempre.</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setShowPolicyModal(false)} className="text-slate-400">Cancelar</button>
                        <button onClick={createPolicy} className="bg-emerald-600 text-white px-4 py-2 rounded">Criar Regra</button>
                    </div>
                </div>
            </div>
        )}

        {/* User Modal */}
        {showUserModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                 <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-96">
                     <h3 className="text-white font-bold mb-4">Adicionar Usuário</h3>
                     <input className="w-full mb-2 bg-slate-950 border border-slate-700 p-2 text-white rounded" placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                     <input className="w-full mb-4 bg-slate-950 border border-slate-700 p-2 text-white rounded" type="password" placeholder="Senha" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                     <button onClick={createUser} className="w-full bg-blue-600 text-white py-2 rounded">Salvar</button>
                     <button onClick={() => setShowUserModal(false)} className="w-full mt-2 text-slate-500 text-sm">Cancelar</button>
                 </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Policies List */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShieldCheck className="text-emerald-500" /> Regras de Acesso (RLS)</h2>
                    <button onClick={() => setShowPolicyModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded"><Plus size={16}/></button>
                </div>
                <div className="space-y-2">
                    {policies.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Nenhuma regra ativa. Tudo está bloqueado por padrão.</p>}
                    {policies.map((p, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-700 p-3 rounded flex justify-between items-center group">
                            <div>
                                <div className="text-white font-bold text-sm">{p.tablename}</div>
                                <div className="text-xs text-slate-400 mt-1">
                                    <span className="text-emerald-400 uppercase font-bold">{p.cmd}</span> para <span className="text-blue-400">{p.roles.join(', ')}</span>
                                </div>
                            </div>
                            <button onClick={() => deletePolicy(p)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Users List */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><User className="text-blue-500" /> Usuários</h2>
                    <button onClick={() => setShowUserModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded"><Plus size={16}/></button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {users.map(u => (
                        <div key={u.id} className="bg-slate-900 border border-slate-700 p-3 rounded flex justify-between items-center">
                             <div className="truncate">
                                 <div className="text-white text-sm">{u.email}</div>
                                 <div className="text-[10px] text-slate-500 uppercase">{u.role} • {u.provider}</div>
                             </div>
                             {/* Simple delete logic can be added here similar to policies */}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};

export default AuthManager;