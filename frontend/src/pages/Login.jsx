import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [mounted, setMounted]   = useState(false);
  const usernameRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => usernameRef.current?.focus(), 400);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      // Mode auto : le backend détecte LDAP ou local
      await login(username.trim(), password, 'auto');
    } catch (err) {
      setError(err.response?.data?.error || 'Identifiants invalides');
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* Fond animé */}
      <div className="login-bg">
        <div className="login-bg__grid" />
        <div className="login-bg__glow login-bg__glow--1" />
        <div className="login-bg__glow login-bg__glow--2" />
        <div className="login-bg__glow login-bg__glow--3" />
      </div>

      {/* Contenu centré */}
      <div className={`login-card ${mounted ? 'login-card--visible' : ''}`}>

        {/* Logo + titre */}
        <div className="login-header">
          <div className="login-logo">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="10" fill="url(#grad)" />
              <rect x="8" y="22" width="5" height="11" rx="1.5" fill="white" fillOpacity=".9" />
              <rect x="16" y="15" width="5" height="18" rx="1.5" fill="white" />
              <rect x="24" y="9" width="5" height="24" rx="1.5" fill="white" fillOpacity=".7" />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b6fd4" />
                  <stop offset="1" stopColor="#1e3a8a" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="login-title">GLPI Dashboard</h1>
            <p className="login-subtitle">Tableau de bord Helpdesk</p>
          </div>
        </div>

        {/* Séparateur */}
        <div className="login-divider" />

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-field">
            <label className="login-label" htmlFor="username">Identifiant</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                id="username"
                ref={usernameRef}
                className="login-input"
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                autoComplete="username"
                placeholder="Votre identifiant"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="password">Mot de passe</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="password"
                className="login-input"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="login-input-toggle"
                onClick={() => setShowPwd(v => !v)}
                tabIndex={-1}
                aria-label={showPwd ? 'Masquer' : 'Afficher'}
              >
                {showPwd ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Message d'erreur */}
          <div className={`login-error ${error ? 'login-error--visible' : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>

          {/* Bouton */}
          <button
            type="submit"
            className="login-btn"
            disabled={loading || !username.trim() || !password}
          >
            {loading ? (
              <span className="login-btn__spinner" />
            ) : (
              <>
                <span>Se connecter</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="login-footer">
          Accès sécurisé · Authentification unifiée AD / Local
        </p>
      </div>

      <style>{`
        /* ── Reset & root ─────────────────────────────────────────────────── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          background: #060d1f;
          position: relative;
          overflow: hidden;
          padding: 1.5rem;
        }

        /* ── Fond animé ───────────────────────────────────────────────────── */
        .login-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .login-bg__grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(59,111,212,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,111,212,.06) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
        }

        .login-bg__glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          animation: glow-pulse 8s ease-in-out infinite;
        }
        .login-bg__glow--1 {
          width: 500px; height: 500px;
          top: -150px; left: -100px;
          background: radial-gradient(circle, rgba(29,78,216,.35) 0%, transparent 70%);
          animation-delay: 0s;
        }
        .login-bg__glow--2 {
          width: 400px; height: 400px;
          bottom: -100px; right: -80px;
          background: radial-gradient(circle, rgba(16,50,150,.3) 0%, transparent 70%);
          animation-delay: -3s;
        }
        .login-bg__glow--3 {
          width: 300px; height: 300px;
          top: 40%; left: 55%;
          background: radial-gradient(circle, rgba(99,102,241,.15) 0%, transparent 70%);
          animation-delay: -5s;
        }

        @keyframes glow-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .7; transform: scale(1.05); }
        }

        /* ── Card ─────────────────────────────────────────────────────────── */
        .login-card {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 20px;
          padding: 2.5rem;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow:
            0 0 0 1px rgba(59,111,212,.12),
            0 32px 64px rgba(0,0,0,.5),
            inset 0 1px 0 rgba(255,255,255,.06);

          opacity: 0;
          transform: translateY(24px);
          transition: opacity .5s ease, transform .5s ease;
        }
        .login-card--visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* ── Header ───────────────────────────────────────────────────────── */
        .login-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.75rem;
        }

        .login-logo {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          filter: drop-shadow(0 4px 12px rgba(59,111,212,.5));
        }
        .login-logo svg { width: 100%; height: 100%; }

        .login-title {
          font-size: 1.375rem;
          font-weight: 700;
          color: #f0f4ff;
          letter-spacing: -.02em;
          line-height: 1.2;
        }

        .login-subtitle {
          font-size: .78rem;
          color: rgba(148,163,184,.7);
          margin-top: .2rem;
          letter-spacing: .01em;
        }

        /* ── Divider ──────────────────────────────────────────────────────── */
        .login-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.08) 40%, rgba(255,255,255,.08) 60%, transparent);
          margin-bottom: 1.75rem;
        }

        /* ── Form ─────────────────────────────────────────────────────────── */
        .login-form { display: flex; flex-direction: column; gap: 1.1rem; }

        .login-field { display: flex; flex-direction: column; gap: .4rem; }

        .login-label {
          font-size: .75rem;
          font-weight: 600;
          color: rgba(148,163,184,.9);
          letter-spacing: .06em;
          text-transform: uppercase;
        }

        .login-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .login-input-icon {
          position: absolute;
          left: .875rem;
          color: rgba(148,163,184,.5);
          display: flex;
          align-items: center;
          pointer-events: none;
        }

        .login-input {
          width: 100%;
          padding: .75rem .875rem .75rem 2.5rem;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          color: #e2e8f0;
          font-size: .9rem;
          font-family: inherit;
          outline: none;
          transition: border-color .2s, background .2s, box-shadow .2s;
        }
        .login-input::placeholder { color: rgba(148,163,184,.35); }
        .login-input:focus {
          border-color: rgba(59,111,212,.6);
          background: rgba(59,111,212,.06);
          box-shadow: 0 0 0 3px rgba(59,111,212,.12);
        }

        .login-input-toggle {
          position: absolute;
          right: .875rem;
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(148,163,184,.4);
          display: flex;
          align-items: center;
          padding: .25rem;
          border-radius: 4px;
          transition: color .15s;
        }
        .login-input-toggle:hover { color: rgba(148,163,184,.8); }

        /* ── Error ────────────────────────────────────────────────────────── */
        .login-error {
          display: flex;
          align-items: center;
          gap: .5rem;
          font-size: .8rem;
          color: #f87171;
          background: rgba(248,113,113,.08);
          border: 1px solid rgba(248,113,113,.2);
          border-radius: 8px;
          padding: .625rem .875rem;
          min-height: 0;
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          transition: max-height .25s ease, opacity .25s ease, padding .25s ease;
          padding-top: 0; padding-bottom: 0;
        }
        .login-error--visible {
          max-height: 60px;
          opacity: 1;
          padding: .625rem .875rem;
        }

        /* ── Submit button ────────────────────────────────────────────────── */
        .login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: .625rem;
          width: 100%;
          padding: .825rem 1.5rem;
          margin-top: .25rem;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          font-size: .9rem;
          font-weight: 600;
          font-family: inherit;
          letter-spacing: .01em;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: transform .15s, box-shadow .15s, opacity .15s;
          box-shadow: 0 4px 16px rgba(37,99,235,.35), 0 1px 0 rgba(255,255,255,.1) inset;
          position: relative;
          overflow: hidden;
        }
        .login-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,.1), transparent);
          opacity: 0;
          transition: opacity .2s;
        }
        .login-btn:hover:not(:disabled)::before { opacity: 1; }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(37,99,235,.45), 0 1px 0 rgba(255,255,255,.1) inset;
        }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-btn:disabled {
          opacity: .45;
          cursor: not-allowed;
          transform: none;
        }

        .login-btn__spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Footer ───────────────────────────────────────────────────────── */
        .login-footer {
          text-align: center;
          font-size: .72rem;
          color: rgba(148,163,184,.35);
          margin-top: 1.5rem;
          letter-spacing: .02em;
        }

        /* ── Responsive ───────────────────────────────────────────────────── */
        @media (max-width: 480px) {
          .login-card { padding: 2rem 1.5rem; }
          .login-title { font-size: 1.2rem; }
        }
      `}</style>
    </div>
  );
}
