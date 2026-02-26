import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('ldap');

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">⚙️ Administration</h2>
        <p className="text-sm text-gray-500 mt-0.5">Gestion LDAP et utilisateurs du dashboard</p>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'ldap', label: '🔗 Configuration LDAP' },
          { id: 'users', label: '👥 Utilisateurs' },
          { id: 'debug', label: '🔍 Diagnostic LDAP' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.id ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'ldap' && <LdapConfig />}
      {activeTab === 'users' && <UsersManager />}
      {activeTab === 'debug' && <LdapDebug />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LDAP Config (connexion + groupes d'accès)
// ─────────────────────────────────────────────────────────────────────────────
function LdapConfig() {
  const [form, setForm] = useState({
    enabled: false, type: 'ad', host: '', port: '389', ssl: false,
    base_dn: '', bind_dn: '', bind_password: '', login_attribute: 'sAMAccountName',
    groups_enabled: false, admin_groups: [], viewer_groups: [], deny_if_no_group: false,
  });
  const [hasPwd, setHasPwd] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/admin/ldap').then(res => {
      const { has_password, ...cfg } = res.data;
      setHasPwd(!!has_password);
      setForm(f => ({
        ...f, ...cfg,
        bind_password: '',
        admin_groups: cfg.admin_groups || [],
        viewer_groups: cfg.viewer_groups || [],
      }));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setStatus(null); setMessage(''); };

  const handleTest = async () => {
    setStatus('testing'); setMessage('');
    try {
      const res = await axios.post('/admin/ldap/test', form);
      setStatus('ok'); setMessage(res.data.message);
    } catch (err) {
      setStatus('error'); setMessage(err.response?.data?.error || 'Connexion échouée');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/admin/ldap/save', form);
      setStatus('saved'); setMessage('Configuration LDAP sauvegardée ✓');
      if (form.bind_password) setHasPwd(true);
    } catch (err) {
      setStatus('error'); setMessage(err.response?.data?.error || 'Sauvegarde échouée');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card h-64 animate-pulse bg-gray-100" />;

  const isOk = status === 'ok' || status === 'saved';

  return (
    <div className="space-y-4">
      {/* ── Connexion LDAP ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-semibold text-gray-800">Connexion LDAP / AD</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {form.enabled ? 'Les utilisateurs peuvent se connecter via LDAP' : 'Désactivé — auth locale uniquement'}
            </p>
          </div>
          <Toggle value={form.enabled} onChange={v => set('enabled', v)} />
        </div>

        {form.enabled && (
          <>
            <div className="flex gap-2 mb-4">
              {[{ id: 'ad', label: '🪟 Active Directory' }, { id: 'openldap', label: '🐧 OpenLDAP' }].map(opt => (
                <button key={opt.id}
                  onClick={() => { set('type', opt.id); set('login_attribute', opt.id === 'ad' ? 'sAMAccountName' : 'uid'); }}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                    form.type === opt.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Serveur LDAP *</label>
                <input className="input" value={form.host} onChange={e => set('host', e.target.value)} placeholder="ad.domaine.local" />
              </div>
              <div>
                <label className="label">Port</label>
                <div className="flex gap-2 items-center">
                  <input className="input" value={form.port} onChange={e => set('port', e.target.value)} />
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer text-gray-600">
                    <input type="checkbox" checked={form.ssl || false}
                      onChange={e => { set('ssl', e.target.checked); set('port', e.target.checked ? '636' : '389'); }} />
                    LDAPS
                  </label>
                </div>
              </div>
              <div className="col-span-2">
                <label className="label">Base DN *</label>
                <input className="input font-mono text-xs" value={form.base_dn} onChange={e => set('base_dn', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Bind DN (compte de service) *</label>
                <input className="input font-mono text-xs" value={form.bind_dn} onChange={e => set('bind_dn', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">
                  Mot de passe du compte de service
                  {hasPwd && <span className="text-xs text-gray-400 ml-2">(laisser vide pour conserver)</span>}
                </label>
                <input className="input" type="password"
                  placeholder={hasPwd ? '••••••• (inchangé)' : 'Mot de passe'}
                  value={form.bind_password} onChange={e => set('bind_password', e.target.value)} />
              </div>
              <div>
                <label className="label">Attribut de login</label>
                <input className="input font-mono text-xs" value={form.login_attribute} onChange={e => set('login_attribute', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">{form.type === 'ad' ? 'sAMAccountName pour AD' : 'uid pour OpenLDAP'}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={handleTest} disabled={status === 'testing' || !form.host}
                className="btn-secondary flex-1 text-sm">
                {status === 'testing' ? 'Test...' : '🔌 Tester la connexion'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Groupes d'accès ────────────────────────────────────────────── */}
      {form.enabled && (
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="font-semibold text-gray-800">Groupes d'accès LDAP</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Associe des groupes LDAP aux rôles <strong>admin</strong> et <strong>viewer</strong>
              </p>
            </div>
            <Toggle value={form.groups_enabled} onChange={v => set('groups_enabled', v)} />
          </div>

          {!form.groups_enabled && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              ⚠️ Groupes désactivés — tout utilisateur LDAP authentifié reçoit le rôle <strong>viewer</strong> par défaut.
            </div>
          )}

          {form.groups_enabled && (
            <div className="mt-4 space-y-4">
              {/* Groupe Admin */}
              <GroupList
                label="Groupes Administrateurs"
                role="admin"
                color="red"
                description="Les membres de ces groupes auront le rôle admin"
                groups={form.admin_groups}
                onChange={v => set('admin_groups', v)}
                ldapEnabled={form.enabled}
              />

              {/* Groupe Viewer */}
              <GroupList
                label="Groupes Viewers"
                role="viewer"
                color="blue"
                description="Les membres de ces groupes auront le rôle viewer"
                groups={form.viewer_groups}
                onChange={v => set('viewer_groups', v)}
                ldapEnabled={form.enabled}
              />

              {/* Option deny_if_no_group */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Refuser si aucun groupe ne correspond</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Si activé, les utilisateurs n'appartenant à aucun groupe ci-dessus ne peuvent pas se connecter.
                      Si désactivé, ils reçoivent le rôle <strong>viewer</strong>.
                    </p>
                  </div>
                  <Toggle value={form.deny_if_no_group} onChange={v => set('deny_if_no_group', v)} />
                </div>
              </div>

              {/* Aperçu logique */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 space-y-1">
                <p className="font-semibold">📋 Logique d'attribution des rôles :</p>
                <p>1. L'utilisateur appartient à un groupe <strong>Admin</strong> → rôle <strong>admin</strong></p>
                <p>2. L'utilisateur appartient à un groupe <strong>Viewer</strong> → rôle <strong>viewer</strong></p>
                <p>3. Aucun groupe correspondant → {form.deny_if_no_group ? <span className="text-red-600 font-semibold">accès refusé</span> : <span>rôle <strong>viewer</strong> par défaut</span>}</p>
                <p className="text-blue-500 mt-1">Le rôle est recalculé à chaque connexion LDAP.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message retour */}
      {message && (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          isOk ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {isOk ? '✓ ' : '✗ '}{message}
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
        {saving ? 'Sauvegarde...' : '💾 Enregistrer la configuration'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupList — liste de groupes LDAP avec ajout, test et suppression
// ─────────────────────────────────────────────────────────────────────────────
function GroupList({ label, role, color, description, groups, onChange, ldapEnabled }) {
  const [input, setInput] = useState('');
  const [testing, setTesting] = useState(null); // index en cours de test
  const [testResults, setTestResults] = useState({}); // { index: 'ok'|'error' }

  const colorMap = {
    red:  { badge: 'bg-red-100 text-red-700', border: 'border-red-300', btn: 'text-red-500 hover:text-red-700 hover:bg-red-50' },
    blue: { badge: 'bg-blue-100 text-blue-700', border: 'border-blue-300', btn: 'text-blue-500 hover:text-blue-700 hover:bg-blue-50' },
  };
  const c = colorMap[color];

  const add = () => {
    const val = input.trim();
    if (!val || groups.includes(val)) return;
    onChange([...groups, val]);
    setInput('');
  };

  const remove = (idx) => {
    onChange(groups.filter((_, i) => i !== idx));
    setTestResults(r => { const n = { ...r }; delete n[idx]; return n; });
  };

  const testGroup = async (dn, idx) => {
    setTesting(idx);
    try {
      await axios.post('/admin/ldap/test-group', { group_dn: dn });
      setTestResults(r => ({ ...r, [idx]: 'ok' }));
    } catch (err) {
      setTestResults(r => ({ ...r, [idx]: 'error' }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className={`border-2 rounded-xl p-4 ${c.border} bg-white`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.badge}`}>
          {role === 'admin' ? '👑 Admin' : '👁 Viewer'}
        </span>
        <p className="text-sm font-medium text-gray-700">{label}</p>
      </div>
      <p className="text-xs text-gray-400 mb-3">{description}</p>

      {/* Groupes existants */}
      <div className="space-y-2 mb-3">
        {groups.length === 0 && (
          <p className="text-xs text-gray-400 italic py-2 text-center">
            Aucun groupe configuré
          </p>
        )}
        {groups.map((dn, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="flex-1 font-mono text-xs text-gray-700 break-all">{dn}</span>
            <div className="flex items-center gap-1 shrink-0">
              {/* Résultat test */}
              {testResults[idx] === 'ok' && <span className="text-green-500 text-xs">✓</span>}
              {testResults[idx] === 'error' && <span className="text-red-500 text-xs">✗</span>}

              {/* Bouton test */}
              <button
                onClick={() => testGroup(dn, idx)}
                disabled={testing === idx}
                title="Vérifier ce groupe"
                className="px-2 py-0.5 text-xs text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
              >
                {testing === idx ? '...' : '🔍'}
              </button>

              {/* Bouton supprimer */}
              <button
                onClick={() => remove(idx)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${c.btn}`}
                title="Supprimer ce groupe"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Ajout nouveau groupe */}
      <div className="flex gap-2">
        <input
          className="input text-xs font-mono flex-1"
          placeholder={`CN=NomDuGroupe,OU=Groups,DC=domaine,DC=local`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <button
          onClick={add}
          disabled={!input.trim()}
          className="btn-primary text-xs px-3 shrink-0"
        >
          + Ajouter
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Users Manager
// ─────────────────────────────────────────────────────────────────────────────
function UsersManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    axios.get('/admin/users').then(res => setUsers(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true); setError('');
    try {
      await axios.post('/admin/users', newUser);
      setNewUser({ username: '', password: '', role: 'viewer' });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur création');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (id, role) => {
    try { await axios.put(`/admin/users/${id}/role`, { role }); load(); }
    catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const handleDelete = async (id, username) => {
    if (!confirm(`Supprimer l'utilisateur "${username}" ?`)) return;
    try { await axios.delete(`/admin/users/${id}`); load(); }
    catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {users.filter(u => u.auth_type === 'ldap').length} LDAP · {users.filter(u => u.auth_type === 'local').length} local
        </p>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm">
          {showCreate ? '✕ Annuler' : '+ Nouvel utilisateur local'}
        </button>
      </div>

      {showCreate && (
        <div className="card border-2 border-brand-200">
          <h3 className="font-semibold text-gray-700 mb-4">Créer un utilisateur local</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Nom d'utilisateur</label>
              <input className="input" value={newUser.username}
                onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input className="input" type="password" placeholder="Min. 8 caractères" value={newUser.password}
                onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
            </div>
            <div>
              <label className="label">Rôle</label>
              <select className="input" value={newUser.role}
                onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">✗ {error}</p>}
          <button onClick={handleCreate} disabled={creating} className="btn-primary mt-3 text-sm">
            {creating ? 'Création...' : 'Créer le compte'}
          </button>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Utilisateur</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rôle</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Dernière connexion</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading
              ? [...Array(3)].map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3">
                    <div className="h-5 bg-gray-100 rounded animate-pulse" />
                  </td></tr>
                ))
              : users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">
                          {u.username[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{u.username}</p>
                          {u.auth_type === 'ldap' && u.ldap_dn && (
                            <p className="text-[10px] text-gray-400 truncate max-w-[200px]" title={u.ldap_dn}>{u.ldap_dn}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.auth_type === 'ldap' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.auth_type === 'ldap' ? '🔗 LDAP' : '👤 Local'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                          <option value="viewer">Viewer</option>
                          <option value="admin">Admin</option>
                        </select>
                        {u.auth_type === 'ldap' && (
                          <span className="text-[10px] text-gray-400" title="Rôle recalculé à chaque connexion via les groupes LDAP">
                            🔄 auto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : 'Jamais'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(u.id, u.username)}
                        className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors">
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">Aucun utilisateur</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle switch réutilisable (corrigé)
// ─────────────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-brand-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic LDAP — teste le login étape par étape
// ─────────────────────────────────────────────────────────────────────────────
function LdapDebug() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await axios.post('/debug/ldap-login', form);
      setResult(res.data);
    } catch (err) {
      setResult({ success: false, steps: [{ step: 'Erreur HTTP', status: 'error', detail: err.response?.data?.error || err.message }] });
    } finally {
      setRunning(false);
    }
  };

  const statusIcon = (s) => ({ ok: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }[s] || 'ℹ️');
  const statusColor = (s) => ({
    ok:    'border-green-200 bg-green-50',
    error: 'border-red-200 bg-red-50',
    info:  'border-gray-200 bg-gray-50',
  }[s] || 'border-gray-200 bg-gray-50');

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card border-2 border-amber-200 bg-amber-50">
        <p className="text-sm font-semibold text-amber-800 mb-1">🔍 Diagnostic de connexion LDAP</p>
        <p className="text-xs text-amber-700">
          Testez un compte utilisateur AD et visualisez chaque étape du processus d'authentification pour identifier l'erreur précise.
        </p>
      </div>

      <div className="card">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Nom d'utilisateur à tester</label>
            <input className="input" placeholder="jdupont"
              value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Juste le login, sans domaine</p>
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input className="input" type="password" placeholder="Mot de passe AD"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
        </div>
        <button onClick={run} disabled={running || !form.username || !form.password}
          className="btn-primary w-full">
          {running
            ? <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Diagnostic en cours...
              </span>
            : '▶ Lancer le diagnostic'}
        </button>
      </div>

      {result && (
        <div className="card space-y-2">
          {/* Résultat global */}
          <div className={`p-3 rounded-xl font-semibold text-sm ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {result.success
              ? `✅ Authentification réussie — rôle attribué : ${result.role}`
              : '❌ Authentification échouée — voir l\'étape en erreur ci-dessous'}
          </div>

          {/* Étapes */}
          {result.steps.map((s, i) => (
            <div key={i} className={`border rounded-xl p-3 ${statusColor(s.status)}`}>
              <div className="flex items-center gap-2 mb-1">
                <span>{statusIcon(s.status)}</span>
                <span className="text-sm font-medium text-gray-800">{s.step}</span>
              </div>
              <pre className="text-xs text-gray-600 bg-white/70 rounded-lg p-2 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {typeof s.detail === 'object' ? JSON.stringify(s.detail, null, 2) : String(s.detail)}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Guide des erreurs courantes */}
      <div className="card text-xs space-y-2 text-gray-600">
        <p className="font-semibold text-gray-700">📚 Erreurs courantes AD :</p>
        <div className="space-y-1.5">
          {[
            { err: "Aucun utilisateur trouvé", fix: "Vérifiez le login_attribute (sAMAccountName), la base DN et que l'utilisateur existe dans l'OU" },
            { err: "Bind utilisateur échoué / 49 LDAP_INVALID_CREDENTIALS", fix: "Mot de passe incorrect ou compte verrouillé/expiré dans AD" },
            { err: "Service bind échoué", fix: "Le compte de service est peut-être verrouillé ou son mot de passe a changé" },
            { err: "Erreur réseau / EAI_AGAIN", fix: "Utilisez l'IP du serveur AD plutôt que le hostname" },
            { err: "Rôle null / accès refusé", fix: "L'utilisateur n'est dans aucun groupe configuré. Désactivez 'Refuser si aucun groupe' ou ajoutez son groupe." },
          ].map((item, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-red-500 shrink-0">•</span>
              <span><strong>{item.err}</strong> → {item.fix}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
