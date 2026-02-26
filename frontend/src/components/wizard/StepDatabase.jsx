import React, { useState } from 'react';
import axios from 'axios';

const DEFAULT = { host: 'localhost', port: '3306', database: 'glpi', user: '', password: '' };

export default function StepDatabase({ onSuccess }) {
  const [form, setForm] = useState(DEFAULT);
  const [status, setStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTest = async () => {
    setStatus('testing');
    setMessage('');
    try {
      const res = await axios.post('/setup/test-db', form);
      setStatus('ok');
      setMessage(res.data.message);
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Connexion échouée');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/setup/save-db', form);
      onSuccess();
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Sauvegarde échouée');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">🗄️ Base de données GLPI</h2>
        <p className="text-gray-500 text-sm mt-1">
          Connexion en lecture seule à la base MySQL de votre instance GLPI.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Hôte *</label>
          <input className="input" placeholder="192.168.x.x" value={form.host}
            onChange={e => set('host', e.target.value)} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Port</label>
          <input className="input" placeholder="3306" value={form.port}
            onChange={e => set('port', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Nom de la base *</label>
          <input className="input" placeholder="glpi" value={form.database}
            onChange={e => set('database', e.target.value)} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Utilisateur MySQL *</label>
          <input className="input" placeholder="glpi_readonly" value={form.user}
            onChange={e => set('user', e.target.value)} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Mot de passe</label>
          <input className="input" type="password" placeholder="••••••••" value={form.password}
            onChange={e => set('password', e.target.value)} />
        </div>
      </div>

      {/* Hint utilisateur dédié */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <strong>💡 Recommandé :</strong> créez un utilisateur MySQL en lecture seule :
        <code className="block mt-1 bg-blue-100 rounded px-2 py-1 font-mono">
          GRANT SELECT ON glpi.* TO 'glpi_readonly'@'%' IDENTIFIED BY 'motdepasse';
        </code>
      </div>

      {/* Message retour */}
      {message && (
        <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
          status === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {status === 'ok' ? '✓ ' : '✗ '}{message}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleTest}
          disabled={status === 'testing' || !form.host || !form.database || !form.user}
          className="btn-secondary flex-1"
        >
          {status === 'testing' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Test en cours...
            </span>
          ) : '🔌 Tester la connexion'}
        </button>
        <button
          onClick={handleSave}
          disabled={status !== 'ok' || saving}
          className="btn-primary flex-1"
        >
          {saving ? 'Sauvegarde...' : 'Suivant →'}
        </button>
      </div>
    </div>
  );
}
