import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { User, ShieldCheck, Plus, Trash2, Key, ToggleLeft, ToggleRight, Check, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const AuthManager = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'users' | 'policies' | 'providers'>('users');
  
  const [users, setUsers] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ apiExternalUrl: '' });

  const [showUserModal, setShowUserModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });
  const [newPolicy, setNewPolicy] = useState({ table: '', action: 'SELECT', role: 'authenticated', condition: 'true' });
  const [googleConfig, setGoogleConfig] = useState({ client_id: '', client_secret: '', enabled: false });

  useEffect(() => { 
      api.get('/config').then(setConfig).catch(console.error);
      refresh(); 
  }, []);

  const refresh = () => {
      api.get('/users').then(data => setUsers(Array.isArray(data) ? data : [])).catch(() => setUsers([]));
      api.get('/policies').then(data => setPolicies(Array.isArray(data) ? data : [])).catch(() => setPolicies([]));
      api.get('/tables').then(setTables).catch(console.error);
      api.get('/auth/providers').then((data) => {
          if(!Array.isArray(data)) return;
          setProviders(data);
          const g = data.find((p:any) => p.id === 'google');
          if(g) setGoogleConfig({ client_id: g.client_id, client_secret: g.client_secret, enabled: g.enabled });
      }).catch(console.error);
  };

  const createUser = async () => {
      try { await api.post('/auth/register', newUser); setShowUserModal(false); refresh(); } catch(e:any){alert(e.message);}
  };

  const createPolicy = async () => {
      try {
          await api.post('/policies', {
              schema: 'public',
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

  const saveGoogleConfig = async () => {
      try {
          await api.post('/auth/providers', {
              id: 'google',
              client_id: googleConfig.client_id,
              client_secret: googleConfig.client_secret,
              enabled: googleConfig.enabled
          });
          alert("Config Salva!");
          refresh();
      } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
        <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg w-fit border border-slate-700">
            <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${activeTab === 'users' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-white'}`}><User size={16}/> Usuários</button>
            <button onClick={() => setActiveTab('policies')} className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${activeTab === 'policies' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-white'}`}><ShieldCheck size={16}/> Regras RLS</button>
            <button onClick={() => setActiveTab('providers')} className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${activeTab === 'providers' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Key size={16}/> Provedores (OAuth)</button>
        </div>

        <div className="flex-1 overflow-auto">
            {activeTab === 'users' && (
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Usuários Cadastrados</h2>
                        <button onClick={() => setShowUserModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded flex items-center gap-2 text-sm"><Plus size={16}/> Adicionar</button>
                    </div>
                    <div className="space-y-2">
                        {users.map(u => (
                            <div key={u.id} className="bg-slate-900 border border-slate-700 p-3 rounded flex justify-between items-center">
                                <div>
                                    <div className="text-white text-sm font-bold">{u.email}</div>
                                    <div className="text-[10px] text-slate-500 uppercase flex gap-2">
                                        <span className="bg-slate-800 px-1 rounded">{u.role}</span>
                                        <span>{u.provider}</span>
                                        <span>ID: {u.id}</span>
                                    </div>
                                </div>
                                <button className="text-slate-600 hover:text-red-400"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'policies' && (
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">Row Level Security (RLS)</h2>
                            <p className="text-sm text-slate-400">Proteja seus dados definindo quem pode acessar o quê.</p>
                        </div>
                        <button onClick={() => setShowPolicyModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded flex items-center gap-2 text-sm"><Plus size={16}/> Nova Regra</button>
                    </div>
                    {policies.length === 0 && <p className="text-slate-500 text-sm text-center py-10 border-2 border-dashed border-slate-700 rounded">Nenhuma regra ativa. O acesso é negado por padrão quando o RLS é ativado.</p>}
                    <div className="grid gap-3">
                        {policies.map((p, i) => (
                            <div key={i} className="bg-slate-900 border border-slate-700 p-4 rounded flex justify-between items-center group">
                                <div>
                                    <div className="text-white font-bold text-sm flex items-center gap-2">
                                        {p.tablename} 
                                        <span className="text-xs font-normal text-slate-500">({p.schemaname})</span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        Permitir <span className="text-emerald-400 uppercase font-bold">{p.cmd}</span> para <span className="text-blue-400 font-mono font-bold">{p.roles.join(', ')}</span> se:
                                    </div>
                                    <code className="text-[11px] text-orange-300 bg-slate-950 px-1 py-0.5 rounded mt-1 block w-fit border border-slate-800">{p.qual} {p.with_check}</code>
                                </div>
                                <button onClick={() => deletePolicy(p)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'providers' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                             <div><h2 className="text-xl font-bold text-white">Google OAuth 2.0</h2></div>
                             <div className="flex items-center gap-2">
                                 <span className={`text-xs uppercase font-bold ${googleConfig.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>{googleConfig.enabled ? 'Ativado' : 'Desativado'}</span>
                                 <button onClick={() => setGoogleConfig({...googleConfig, enabled: !googleConfig.enabled})} className="text-slate-300 hover:text-white">{googleConfig.enabled ? <ToggleRight size={32} className="text-emerald-500"/> : <ToggleLeft size={32} className="text-slate-600"/>}</button>
                             </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client ID</label><input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 text-sm" value={googleConfig.client_id} onChange={e => setGoogleConfig({...googleConfig, client_id: e.target.value})}/></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client Secret</label><input type="password" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 text-sm" value={googleConfig.client_secret} onChange={e => setGoogleConfig({...googleConfig, client_secret: e.target.value})}/></div>
                        </div>
                        <div className="mt-4 bg-slate-900 p-3 rounded border border-slate-700">
                             <p className="text-xs text-slate-400 mb-1">Callback URL:</p>
                             <code className="text-xs text-blue-400 select-all block break-all">{config.apiExternalUrl ? `${config.apiExternalUrl}/api/auth/google/callback` : 'Carregando URL...'}</code>
                        </div>
                        <div className="mt-6 flex justify-end"><button onClick={saveGoogleConfig} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"><Check size={16}/> Salvar Configuração</button></div>
                    </div>
                </div>
            )}
        </div>

        {/* POLICY MODAL */}
        {showPolicyModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-lg w-full shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-4">Nova Regra de Segurança</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-slate-400 text-sm mb-1">Tabela Alvo</label>
                            <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newPolicy.table} onChange={e => setNewPolicy({...newPolicy, table: e.target.value})}>
                                <option value="">Selecione...</option>
                                {tables.map(t => <option key={t.table_name} value={t.table_name}>{t.table_name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-slate-400 text-sm mb-1">Quem pode acessar?</label>
                                <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newPolicy.role} onChange={e => setNewPolicy({...newPolicy, role: e.target.value})}>
                                    <option value="authenticated">Logado (authenticated)</option>
                                    <option value="anon">Visitante (anon)</option>
                                    <option value="public">Todos (public)</option>
                                    <option value="service_role">Service Role (Admin)</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-slate-400 text-sm mb-1">Ação</label>
                                <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newPolicy.action} onChange={e => setNewPolicy({...newPolicy, action: e.target.value})}>
                                    <option value="SELECT">SELECT (Ler)</option>
                                    <option value="INSERT">INSERT (Criar)</option>
                                    <option value="UPDATE">UPDATE (Editar)</option>
                                    <option value="DELETE">DELETE (Excluir)</option>
                                    <option value="ALL">ALL (Tudo)</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-slate-400 text-sm">Condição SQL</label>
                                <div className="flex gap-2 text-[10px]">
                                    <button onClick={() => setNewPolicy({...newPolicy, condition: 'true'})} className="text-blue-400 hover:underline">Sempre (true)</button>
                                    <button onClick={() => setNewPolicy({...newPolicy, condition: 'auth.uid() = user_id'})} className="text-emerald-400 hover:underline">Dono (auth.uid)</button>
                                </div>
                            </div>
                            <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-emerald-400 font-mono text-sm" value={newPolicy.condition} onChange={e => setNewPolicy({...newPolicy, condition: e.target.value})} placeholder="ex: auth.uid() = user_id" />
                            <p className="text-[10px] text-slate-500 mt-1">Dica: Use <span className="font-mono text-slate-400">auth.uid()</span> para pegar o ID do usuário logado.</p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setShowPolicyModal(false)} className="text-slate-400">Cancelar</button>
                        <button onClick={createPolicy} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold">Criar Regra</button>
                    </div>
                </div>
            </div>
        )}

        {showUserModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                 <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-96">
                     <h3 className="text-white font-bold mb-4">Novo Usuário</h3>
                     <input className="w-full mb-2 bg-slate-950 border border-slate-700 p-2 text-white rounded" placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                     <input className="w-full mb-4 bg-slate-950 border border-slate-700 p-2 text-white rounded" type="password" placeholder="Senha" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                     <div className="flex justify-end gap-2">
                        <button onClick={() => setShowUserModal(false)} className="text-slate-500">Cancelar</button>
                        <button onClick={createUser} className="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button>
                     </div>
                 </div>
            </div>
        )}
    </div>
  );
};

export default AuthManager;