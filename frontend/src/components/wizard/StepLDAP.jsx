import React, { useState } from 'react';
import axios from 'axios';

const DEFAULT_AD = {
  type: 'ad', host: '', port: '389', ssl: false,
  base_dn: 'DC=mondomaine,DC=local',
  bind_dn: 'CN=svc-glpi,OU=Services,DC=mondomaine,DC=local',
  bind_password: '', login_attribute: 'sAMAccountName', enabled: true,
  groups_enabled: false, admin_groups: [], viewer_groups: [], deny_if_no_group: false,
};
const DEFAULT_LDAP = {
  type: 'openldap', host: '', port: '389', ssl: false,
  base_dn: 'dc=mondomaine,dc=local',
  bind_dn: 'cn=admin,dc=mondomaine,dc=local',
  bind_password: '', login_attribute: 'uid', enabled: true,
  groups_enabled: false, admin_groups: [], viewer_groups: [], deny_if_no_group: false,
};

export default function StepLDAP({ onSuccess, onSkip, onBack }) {
  const [enabled, setEnabled]       = useState(false);
  const [ldapType, setLdapType]     = useState('ad');
  const [form, setForm]             = useState(DEFAULT_AD);
  const [status, setStatus]         = useState(null);
  const [message, setMessage]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [newAdminDn, setNewAdminDn] = useState('');
  const [newViewerDn, setNewViewerDn] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const switchType = (type) => {
    setLdapType(type);
    setForm(type === 'ad' ? DEFAULT_AD : DEFAULT_LDAP);
    setStatus(null); setMessage('');
  };

  const addGroup = (type) => {
    const dn = type === 'admin' ? newAdminDn.trim() : newViewerDn.trim();
    if (!dn) return;
    const key = type === 'admin' ? 'admin_groups' : 'viewer_groups';
    set(key, [...(form[key] || []), dn]);
    type === 'admin' ? setNewAdminDn('') : setNewViewerDn('');
  };

  const removeGroup = (type, idx) => {
    const key = type === 'admin' ? 'admin_groups' : 'viewer_groups';
    set(key, form[key].filter((_, i) => i !== idx));
  };

  const handleTest = async () => {
    setStatus('testing'); setMessage('');
    try {
      const res = await axios.post('/setup/test-ldap', { ...form, enabled: true });
      setStatus('ok'); setMessage(res.data.message);
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Connexion LDAP échouée');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/setup/save-ldap', { ...form, enabled: true });
      onSuccess();
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Sauvegarde échouée');
    } finally { setSaving(false); }
  };

  const handleSkip = async () => {
    await axios.post('/setup/save-ldap', { enabled: false });
    onSkip();
  };

  const Toggle = ({ value, onChange, label }) => (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-brand-500' : 'bg-gray-300'}`}
      aria-label={label}
    >
      <span className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">🔗 Connexion LDAP</h2>
        <p className="text-gray-500 text-sm mt-1">
          Optionnel — permet aux utilisateurs AD/LDAP de se connecter au dashboard.
        </p>
      </div>

      {/* Toggle activation */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg mb-5">
        <Toggle value={enabled} onChange={setEnabled} label="Activer LDAP" />
        <span className="font-medium text-gray-700">
          {enabled ? 'LDAP activé' : 'LDAP désactivé (auth locale uniquement)'}
        </span>
      </div>

      {enabled && (
        <>
          {/* Type */}
          <div className="flex gap-2 mb-5">
            {[
              { id: 'ad',       label: '🪟 Active Directory', desc: 'Windows Server / Azure AD' },
              { id: 'openldap', label: '🐧 OpenLDAP',         desc: 'Linux / RFC 2307' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => switchType(opt.id)}
                className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${
                  ldapType === opt.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>

          {/* Connexion */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Serveur LDAP *</label>
              <input className="input" placeholder="ad.mondomaine.local" value={form.host}
                onChange={e => set('host', e.target.value)} />
            </div>
            <div>
              <label className="label">Port</label>
              <div className="flex gap-2 items-center">
                <input className="input" placeholder={form.ssl ? '636' : '389'} value={form.port}
                  onChange={e => set('port', e.target.value)} />
                <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap cursor-pointer">
                  <input type="checkbox" checked={form.ssl}
                    onChange={e => { set('ssl', e.target.checked); set('port', e.target.checked ? '636' : '389'); }} />
                  LDAPS
                </label>
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">Base DN *</label>
              <input className="input font-mono text-xs" value={form.base_dn}
                onChange={e => set('base_dn', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Compte de service (Bind DN) *</label>
              <input className="input font-mono text-xs" value={form.bind_dn}
                onChange={e => set('bind_dn', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Mot de passe du compte de service *</label>
              <input className="input" type="password" placeholder="••••••••" value={form.bind_password}
                onChange={e => set('bind_password', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Attribut de login</label>
              <input className="input font-mono text-xs" value={form.login_attribute}
                onChange={e => set('login_attribute', e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">
                {ldapType === 'ad' ? 'sAMAccountName pour AD' : 'uid pour OpenLDAP'}
              </p>
            </div>
          </div>

          {/* ── Groupes d'accès ─────────────────────────────────────────── */}
          <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
            {/* En-tête section groupes */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div>
                <p className="text-sm font-semibold text-gray-700">Groupes d'accès</p>
                <p className="text-xs text-gray-400 mt-0.5">Associer des groupes AD aux rôles admin / viewer</p>
              </div>
              <Toggle
                value={form.groups_enabled}
                onChange={v => set('groups_enabled', v)}
                label="Activer les groupes"
              />
            </div>

            {form.groups_enabled && (
              <div className="p-4 space-y-5">
                {/* Groupes Admin */}
                <GroupList
                  label="Groupes Administrateurs"
                  color="red"
                  groups={form.admin_groups}
                  newDn={newAdminDn}
                  onChangeDn={setNewAdminDn}
                  onAdd={() => addGroup('admin')}
                  onRemove={i => removeGroup('admin', i)}
                />

                {/* Groupes Viewer */}
                <GroupList
                  label="Groupes Lecteurs"
                  color="blue"
                  groups={form.viewer_groups}
                  newDn={newViewerDn}
                  onChangeDn={setNewViewerDn}
                  onAdd={() => addGroup('viewer')}
                  onRemove={i => removeGroup('viewer', i)}
                />

                {/* Refuser si aucun groupe */}
                <div className="flex items-start gap-3 pt-2 border-t border-gray-100">
                  <Toggle
                    value={form.deny_if_no_group}
                    onChange={v => set('deny_if_no_group', v)}
                    label="Refuser si aucun groupe"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Refuser si aucun groupe correspondant</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {form.deny_if_no_group
                        ? 'Accès refusé si l\'utilisateur n\'appartient à aucun groupe configuré'
                        : 'Rôle Lecteur attribué par défaut si aucun groupe ne correspond'}
                    </p>
                  </div>
                </div>

                {/* Logique */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                  <p className="font-semibold">Logique d'attribution :</p>
                  <p>1. Appartient à un groupe Admin → rôle <strong>admin</strong></p>
                  <p>2. Appartient à un groupe Lecteur → rôle <strong>viewer</strong></p>
                  <p>3. Aucune correspondance → {form.deny_if_no_group ? <strong>accès refusé</strong> : <span>rôle <strong>viewer</strong> par défaut</span>}</p>
                  <p className="text-blue-500 mt-1">Le rôle est recalculé à chaque connexion.</p>
                </div>
              </div>
            )}
          </div>

          {/* Message test */}
          {message && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
              status === 'ok'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {status === 'ok' ? '✓ ' : '✗ '}{message}
            </div>
          )}
        </>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="btn-secondary">← Retour</button>
        {!enabled ? (
          <button onClick={handleSkip} className="btn-primary flex-1">Passer cette étape →</button>
        ) : (
          <>
            <button
              onClick={handleTest}
              disabled={status === 'testing' || !form.host || !form.bind_dn || !form.bind_password}
              className="btn-secondary flex-1"
            >
              {status === 'testing' ? 'Test...' : '🔌 Tester la connexion'}
            </button>
            <button
              onClick={handleSave}
              disabled={status !== 'ok' || saving}
              className="btn-primary flex-1"
            >
              {saving ? 'Sauvegarde...' : 'Suivant →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GroupList({ label, color, groups, newDn, onChangeDn, onAdd, onRemove }) {
  const border = color === 'red' ? 'border-red-200' : 'border-blue-200';
  const badge  = color === 'red'
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-blue-50 text-blue-700 border-blue-200';
  const btn    = color === 'red'
    ? 'text-red-400 hover:text-red-600'
    : 'text-blue-400 hover:text-blue-600';
  const addBtn = color === 'red'
    ? 'border-red-200 text-red-600 hover:bg-red-50'
    : 'border-blue-200 text-blue-600 hover:bg-blue-50';

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
      {groups.length > 0 && (
        <div className={`mb-2 space-y-1.5 p-2 bg-gray-50 border ${border} rounded-lg`}>
          {groups.map((dn, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${badge} truncate`}>
                {dn}
              </span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className={`shrink-0 text-xs ${btn}`}
                title="Retirer"
              >✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="input text-xs font-mono flex-1"
          placeholder={`CN=NomGroupe,OU=Groupes,DC=domaine,DC=local`}
          value={newDn}
          onChange={e => onChangeDn(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAdd())}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!newDn.trim()}
          className={`px-3 py-2 text-xs font-medium border rounded-lg transition-colors disabled:opacity-40 ${addBtn}`}
        >
          + Ajouter
        </button>
      </div>
    </div>
  );
}
