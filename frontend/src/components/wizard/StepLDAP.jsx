import React, { useState } from 'react';
import axios from 'axios';

const DEFAULT_AD = { type: 'ad', host: '', port: '389', ssl: false, base_dn: 'DC=mondomaine,DC=local', bind_dn: 'CN=svc-glpi,OU=Services,DC=mondomaine,DC=local', bind_password: '', login_attribute: 'sAMAccountName', enabled: true };
const DEFAULT_LDAP = { type: 'openldap', host: '', port: '389', ssl: false, base_dn: 'dc=mondomaine,dc=local', bind_dn: 'cn=admin,dc=mondomaine,dc=local', bind_password: '', login_attribute: 'uid', enabled: true };

export default function StepLDAP({ onSuccess, onSkip, onBack }) {
  const [enabled, setEnabled] = useState(false);
  const [ldapType, setLdapType] = useState('ad');
  const [form, setForm] = useState(DEFAULT_AD);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const switchType = (type) => {
    setLdapType(type);
    setForm(type === 'ad' ? DEFAULT_AD : DEFAULT_LDAP);
    setStatus(null);
    setMessage('');
  };

  const handleTest = async () => {
    setStatus('testing');
    setMessage('');
    try {
      const res = await axios.post('/setup/test-ldap', { ...form, enabled: true });
      setStatus('ok');
      setMessage(res.data.message);
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
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    // Sauvegarde LDAP désactivé
    await axios.post('/setup/save-ldap', { enabled: false });
    onSkip();
  };

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
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-brand-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
        <span className="font-medium text-gray-700">
          {enabled ? 'LDAP activé' : 'LDAP désactivé (auth locale uniquement)'}
        </span>
      </div>

      {enabled && (
        <>
          {/* Type AD vs OpenLDAP */}
          <div className="flex gap-2 mb-5">
            {[
              { id: 'ad', label: '🪟 Active Directory', desc: 'Windows Server / Azure AD' },
              { id: 'openldap', label: '🐧 OpenLDAP', desc: 'Linux / RFC 2307' },
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
                  <input type="checkbox" checked={form.ssl} onChange={e => { set('ssl', e.target.checked); set('port', e.target.checked ? '636' : '389'); }} />
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

          {message && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
              status === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {status === 'ok' ? '✓ ' : '✗ '}{message}
            </div>
          )}
        </>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="btn-secondary">← Retour</button>

        {!enabled ? (
          <button onClick={handleSkip} className="btn-primary flex-1">
            Passer cette étape →
          </button>
        ) : (
          <>
            <button
              onClick={handleTest}
              disabled={status === 'testing' || !form.host || !form.bind_dn || !form.bind_password}
              className="btn-secondary flex-1"
            >
              {status === 'testing' ? 'Test...' : '🔌 Tester'}
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
