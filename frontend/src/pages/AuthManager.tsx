import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { User, ShieldCheck, Plus, Trash2, Key, ToggleLeft, ToggleRight, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const AuthManager = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'users' | 'policies' | 'providers'>('users');
  
  // Data
  const [users, setUsers] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  
  // Real Configuration from Backend
  const [config, setConfig] = useState<any>({ apiExternalUrl: '' });

  // UI States
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  
  // Form Data
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });
  const [newPolicy, setNewPolicy] = useState({ table: '', action: 'SELECT', role: 'authenticated', condition: 'true' });
  const [googleConfig, setGoogleConfig] = useState({ client_id: '', client_secret: '', enabled: false });

  useEffect(() => { 
      // Load config to get real domains
      api.get('/config').then(setConfig).catch(console.error);
      refresh(); 
  }, []);

  const refresh = () => {
      api.get('/users').then(setUsers).catch(console.error);
      api.get('/policies').then(setPolicies).catch(console.error);
      api.get('/tables').then(setTables).catch(console.error);
      api.get('/auth/providers').then((data) => {
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
          alert("Configurações do Google Salvas! O Login estará disponível imediatamente.");
          refresh();
      } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg w-fit border border-slate-700">
            <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${activeTab === 'users' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                <User size={16}/> Usuários
            </button>
            <button onClick={() => setActiveTab('policies')} className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${activeTab === 'policies' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                <ShieldCheck size={16}/> Regras RLS
            </button>
            <button onClick={() => setActiveTab('providers')} className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${activeTab === 'providers' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                <Key size={16}/> Provedores (OAuth)
            </button>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-auto">
            {/* USERS TAB */}
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

            {/* POLICIES TAB */}
            {activeTab === 'policies' && (
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Políticas de Segurança (Row Level Security)</h2>
                        <button onClick={() => setShowPolicyModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded flex items-center gap-2 text-sm"><Plus size={16}/> Nova Regra</button>
                    </div>
                    {policies.length === 0 && <p className="text-slate-500 text-sm text-center py-10 border-2 border-dashed border-slate-700 rounded">Nenhuma regra ativa. O acesso padrão é negado.</p>}
                    <div className="grid gap-3">
                        {policies.map((p, i) => (
                            <div key={i} className="bg-slate-900 border border-slate-700 p-4 rounded flex justify-between items-center group">
                                <div>
                                    <div className="text-white font-bold text-sm flex items-center gap-2">
                                        {p.tablename} 
                                        <span className="text-xs font-normal text-slate-500">({p.schemaname})</span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        Permitir <span className="text-emerald-400 uppercase font-bold">{p.cmd}</span> para <span className="text-blue-400 font-mono">{p.roles.join(', ')}</span> se:
                                    </div>
                                    <code className="text-[11px] text-orange-300 bg-slate-950 px-1 py-0.5 rounded mt-1 block w-fit">{p.qual} {p.with_check}</code>
                                </div>
                                <button onClick={() => deletePolicy(p)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* PROVIDERS TAB */}
            {activeTab === 'providers' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                             <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">Google OAuth 2.0</h2>
                                <p className="text-sm text-slate-400">Permita que usuários façam login usando suas contas Google.</p>
                             </div>
                             <div className="flex items-center gap-2">
                                 <span className={`text-xs uppercase font-bold ${googleConfig.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                                     {googleConfig.enabled ? 'Ativado' : 'Desativado'}
                                 </span>
                                 <button onClick={() => setGoogleConfig({...googleConfig, enabled: !googleConfig.enabled})} className="text-slate-300 hover:text-white">
                                     {googleConfig.enabled ? <ToggleRight size={32} className="text-emerald-500"/> : <ToggleLeft size={32} className="text-slate-600"/>}
                                 </button>
                             </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client ID</label>
                                <input 
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 text-sm"
                                    placeholder="ex: 123456-abcde.apps.googleusercontent.com"
                                    value={googleConfig.client_id}
                                    onChange={e => setGoogleConfig({...googleConfig, client_id: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client Secret</label>
                                <input 
                                    type="password"
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 text-sm"
                                    placeholder="ex: GOCSPX-xyz..."
                                    value={googleConfig.client_secret}
                                    onChange={e => setGoogleConfig({...googleConfig, client_secret: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="mt-4 bg-slate-900 p-3 rounded border border-slate-700">
                             <p className="text-xs text-slate-400 mb-1">Callback URL (Adicione exatamente este endereço no Console do Google Cloud):</p>
                             {/* DYNAMIC URL - NO MORE HARDCODED STRINGS */}
                             <code className="text-xs text-blue-400 select-all block break-all">
                                {config.apiExternalUrl ? `${config.apiExternalUrl}/api/auth/google/callback` : 'Carregando URL...'}
                             </code>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button onClick={saveGoogleConfig} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2">
                                <Check size={16}/> Salvar Configuração
                            </button>
                        </div>
                    </div>

                    {/* Placeholder for other providers */}
                    <div className="opacity-50 grayscale pointer-events-none select-none">
                         <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white">GitHub OAuth</h2>
                                <p className="text-sm text-slate-400">Em breve...</p>
                            </div>
                            <ToggleLeft size={32} className="text-slate-600"/>
                         </div>
                    </div>
                </div>
            )}
        </div>

        {/* MODALS (User / Policy) */}
        {showPolicyModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-lg w-full shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-4">Nova Regra de Segurança</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-slate-400 text-sm mb-1">Tabela</label>
                            <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newPolicy.table} onChange={e => setNewPolicy({...newPolicy, table: e.target.value})}>
                                <option value="">Selecione...</option>
                                {tables.map(t => <option key={t.table_name} value={t.table_name}>{t.table_name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-slate-400 text-sm mb-1">Role</label>
                                <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newPolicy.role} onChange={e => setNewPolicy({...newPolicy, role: e.target.value})}>
                                    <option value="authenticated">Logado</option>
                                    <option value="anon">Visitante</option>
                                    <option value="public">Todos</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-slate-400 text-sm mb-1">Ação</label>
                                <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={newPolicy.action} onChange={e => setNewPolicy({...newPolicy, action: e.target.value})}>
                                    <option value="SELECT">SELECT</option>
                                    <option value="INSERT">INSERT</option>
                                    <option value="UPDATE">UPDATE</option>
                                    <option value="DELETE">DELETE</option>
                                    <option value="ALL">ALL</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-slate-400 text-sm mb-1">Condição SQL</label>
                            <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-emerald-400 font-mono text-sm" value={newPolicy.condition} onChange={e => setNewPolicy({...newPolicy, condition: e.target.value})} placeholder="auth.uid() = user_id" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setShowPolicyModal(false)} className="text-slate-400">Cancelar</button>
                        <button onClick={createPolicy} className="bg-emerald-600 text-white px-4 py-2 rounded">Criar</button>
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