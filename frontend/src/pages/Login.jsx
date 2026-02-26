import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '', mode: 'local' });
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/auth/ldap-enabled')
      .then(res => setLdapEnabled(res.data.enabled))
      .catch(() => {});
  }, []);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.username, form.password, form.mode);
    } catch (err) {
      setError(err.response?.data?.error || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📊</div>
          <h1 className="text-2xl font-bold text-white">GLPI Dashboard</h1>
          <p className="text-blue-200 text-sm mt-1">Connexion</p>
        </div>

        <div className="card shadow-xl">
          {/* Tabs local / LDAP */}
          {ldapEnabled && (
            <div className="flex mb-5 bg-gray-100 p-1 rounded-lg">
              {['local', 'ldap'].map(mode => (
                <button
                  key={mode}
                  onClick={() => set('mode', mode)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    form.mode === mode ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {mode === 'local' ? '👤 Compte local' : '🔗 LDAP / AD'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nom d'utilisateur</label>
              <input
                className="input"
                value={form.username}
                onChange={e => set('username', e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">
                ✗ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !form.username || !form.password}
              className="btn-primary w-full mt-2 py-2.5"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connexion...
                </span>
              ) : 'Se connecter'}
            </button>
          </form>

          {form.mode === 'ldap' && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Utilisez vos identifiants {form.mode === 'ldap' ? 'Active Directory / LDAP' : 'locaux'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
