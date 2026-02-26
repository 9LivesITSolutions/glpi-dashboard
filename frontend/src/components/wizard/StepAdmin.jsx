import React, { useState } from 'react';
import axios from 'axios';

export default function StepAdmin({ onSuccess, onBack }) {
  const [form, setForm] = useState({ username: 'admin', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = "Nom d'utilisateur requis";
    if (form.password.length < 8) errs.password = 'Minimum 8 caractères';
    if (form.password !== form.confirm) errs.confirm = 'Les mots de passe ne correspondent pas';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const getPasswordStrength = () => {
    const p = form.password;
    if (!p) return { score: 0, label: '', color: '' };
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { score, label: 'Faible', color: 'bg-red-400' };
    if (score <= 3) return { score, label: 'Moyen', color: 'bg-yellow-400' };
    return { score, label: 'Fort', color: 'bg-green-400' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setApiError('');
    try {
      await axios.post('/setup/create-admin', {
        username: form.username.trim(),
        password: form.password,
      });
      onSuccess();
    } catch (err) {
      setApiError(err.response?.data?.error || 'Erreur lors de la création du compte');
    } finally {
      setSubmitting(false);
    }
  };

  const strength = getPasswordStrength();

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">👤 Compte administrateur</h2>
        <p className="text-gray-500 text-sm mt-1">
          Ce compte local permet de toujours accéder au dashboard, même sans LDAP.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">Nom d'utilisateur *</label>
          <input
            className={`input ${errors.username ? 'border-red-400' : ''}`}
            value={form.username}
            onChange={e => set('username', e.target.value)}
            autoComplete="username"
          />
          {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
        </div>

        <div>
          <label className="label">Mot de passe *</label>
          <input
            className={`input ${errors.password ? 'border-red-400' : ''}`}
            type="password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            autoComplete="new-password"
            placeholder="Minimum 8 caractères"
          />
          {form.password && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${strength.color}`}
                  style={{ width: `${(strength.score / 5) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{strength.label}</span>
            </div>
          )}
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
        </div>

        <div>
          <label className="label">Confirmer le mot de passe *</label>
          <input
            className={`input ${errors.confirm ? 'border-red-400' : ''}`}
            type="password"
            value={form.confirm}
            onChange={e => set('confirm', e.target.value)}
            autoComplete="new-password"
          />
          {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm}</p>}
        </div>
      </div>

      {apiError && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          ✗ {apiError}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-5 text-xs text-amber-700">
        🔐 <strong>Important :</strong> conservez ces identifiants précieusement. Ce compte admin local
        est le seul moyen de vous connecter sans LDAP.
      </div>

      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onBack} className="btn-secondary">← Retour</button>
        <button type="submit" disabled={submitting} className="btn-primary flex-1">
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Création...
            </span>
          ) : '🚀 Terminer la configuration'}
        </button>
      </div>
    </form>
  );
}
