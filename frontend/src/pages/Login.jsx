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
      await login(username.trim(), password, 'auto');
    } catch (err) {
      setError(err.response?.data?.error || 'Identifiants invalides');
      setLoading(false);
    }
  };

  return (
    <div className="lr-root">
      {/* ── Panneau gauche ─────────────────────────────────────────────── */}
      <div className="lr-left">
        <div className="lr-glow lr-glow--1" />
        <div className="lr-glow lr-glow--2" />
        <div className="lr-grid" />

        <div className="lr-left-inner">
          {/* Logo */}
          <div className="lr-logo">
            <div className="lr-logo-icon">
              <svg viewBox="0 0 40 40" fill="none">
                <rect x="6"  y="22" width="6" height="12" rx="2" fill="white" fillOpacity=".85"/>
                <rect x="15" y="14" width="6" height="20" rx="2" fill="white"/>
                <rect x="24" y="7"  width="6" height="27" rx="2" fill="white" fillOpacity=".65"/>
              </svg>
            </div>
            <div>
              <div className="lr-logo-name">GLPI Dashboard</div>
              
            </div>
          </div>

          {/* Héro */}
          <div className="lr-hero">
            <h1 className="lr-hero-title">
              Tableau de bord<br/>
              <span className="lr-hero-accent">Helpdesk</span>
            </h1>
            <p className="lr-hero-desc">
              Suivi en temps réel des tickets GLPI — KPIs, SLA, performance
              techniciens et authentification Active Directory intégrée.
            </p>
          </div>

          {/* Features */}
          <div className="lr-features">
            {[
              { icon: '📊', text: 'KPIs et SLA en temps réel' },
              { icon: '🔗', text: 'Authentification Active Directory' },
              { icon: '👤', text: 'Stats détaillées par technicien' },
              { icon: '⏱',  text: 'Temps actif calculé hors pauses' },
            ].map((f, i) => (
              <div className="lr-feature" key={i}>
                <div className="lr-feature-icon">{f.icon}</div>
                <span className="lr-feature-text">{f.text}</span>
              </div>
            ))}
          </div>

          <div className="lr-footer">
            Accès réservé au personnel autorisé · Built by 9Lives IT Solutions
          </div>
        </div>
      </div>

      {/* ── Panneau droit ──────────────────────────────────────────────── */}
      <div className="lr-right">
        <div className={`lr-form-block ${mounted ? 'lr-form-block--in' : ''}`}>
          <div className="lr-form-header">
            <h2 className="lr-form-title">Connexion</h2>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Identifiant */}
            <div className="lr-field">
              <label className="lr-label" htmlFor="username">Identifiant</label>
              <div className="lr-input-wrap">
                <span className="lr-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                <input
                  id="username"
                  ref={usernameRef}
                  className="lr-input"
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  autoComplete="username"
                  placeholder="identifiant"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div className="lr-field">
              <label className="lr-label" htmlFor="password">Mot de passe</label>
              <div className="lr-input-wrap">
                <span className="lr-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="password"
                  className="lr-input"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="lr-pwd-toggle"
                  onClick={() => setShowPwd(v => !v)}
                  tabIndex={-1}
                >
                  {showPwd ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div className="lr-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="lr-btn"
              disabled={loading || !username.trim() || !password}
            >
              {loading
                ? <span className="lr-spinner" />
                : <><span>→ Se connecter</span></>
              }
            </button>
          </form>

          <div className="lr-info">
            <strong>Authentification unifiée</strong><br/>
            Utilisez vos identifiants Windows habituels. En l'absence de compte AD,
            un compte local de secours est disponible.
          </div>
        </div>
      </div>

      <style>{`
        .lr-root {
          display: flex;
          min-height: 100vh;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          background: #0b1529;
          overflow: hidden;
        }

        /* ── Gauche ─────────────────────────────── */
        .lr-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 2.5rem 3rem;
          position: relative;
          overflow: hidden;
          background: #0b1529;
        }
        .lr-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(30,77,183,.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(30,77,183,.07) 1px, transparent 1px);
          background-size: 52px 52px;
          pointer-events: none;
        }
        .lr-glow {
          position: absolute; border-radius: 50%;
          pointer-events: none; filter: blur(90px);
        }
        .lr-glow--1 {
          width: 520px; height: 520px; top: -160px; left: -120px;
          background: radial-gradient(circle, rgba(30,77,183,.28) 0%, transparent 65%);
          animation: lr-breathe 9s ease-in-out infinite;
        }
        .lr-glow--2 {
          width: 380px; height: 380px; bottom: -80px; right: 60px;
          background: radial-gradient(circle, rgba(15,50,130,.22) 0%, transparent 65%);
          animation: lr-breathe 11s ease-in-out infinite reverse;
        }
        @keyframes lr-breathe {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.65; transform:scale(1.06); }
        }

        .lr-left-inner {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          height: 100%; justify-content: space-between;
        }

        .lr-logo {
          display: flex; align-items: center; gap: 1rem;
          animation: lr-up .6s ease .1s both;
        }
        .lr-logo-icon {
          width: 48px; height: 48px;
          background: linear-gradient(135deg, #1e4db7, #0f2f7a);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 20px rgba(30,77,183,.4);
          flex-shrink: 0;
        }
        .lr-logo-icon svg { width: 26px; height: 26px; }
        .lr-logo-name { font-size: 1.05rem; font-weight: 700; color: #dce8ff; letter-spacing: -.01em; }
        .lr-logo-tag  { font-size: .7rem; color: #7b93b8; margin-top: .15rem; }

        .lr-hero { animation: lr-up .7s ease .25s both; }
        .lr-hero-title {
          font-size: 2.5rem; font-weight: 800; color: #e8f0ff;
          line-height: 1.15; letter-spacing: -.03em; margin-bottom: 1rem;
        }
        .lr-hero-accent {
          background: linear-gradient(90deg, #5b8af5, #93b4ff);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lr-hero-desc { font-size: .88rem; color: #7b93b8; line-height: 1.65; max-width: 400px; }

        .lr-features {
          display: flex; flex-direction: column; gap: .65rem;
          animation: lr-up .7s ease .4s both;
          width: 300px;
        }
        .lr-feature {
          display: flex; align-items: center; gap: .875rem;
          padding: .65rem 1rem;
          background: rgba(30,77,183,.08);
          border: 1px solid rgba(30,77,183,.15);
          border-radius: 10px;
          transition: background .2s, border-color .2s;
        }
        .lr-feature:hover { background: rgba(30,77,183,.14); border-color: rgba(30,77,183,.28); }
        .lr-feature-icon {
          width: 30px; height: 30px;
          background: rgba(30,77,183,.2);
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          font-size: .88rem; flex-shrink: 0;
        }
        .lr-feature-text { font-size: .82rem; color: #a8bcd4; font-weight: 500; }

        .lr-footer {
          font-size: .68rem; color: rgba(123,147,184,.35); letter-spacing: .03em;
          animation: lr-up .5s ease .55s both;
        }

        /* ── Droite ─────────────────────────────── */
        .lr-right {
          flex: 0 0 420px;
          width: 420px;
          background: #f7f9fc;
          display: flex; flex-direction: column; justify-content: center;
          padding: 3rem 3.5rem;
          position: relative;
        }
        .lr-right::before {
          content: ''; position: absolute;
          left: 0; top: 10%; bottom: 10%; width: 1px;
          background: linear-gradient(180deg, transparent, rgba(30,77,183,.12) 30%, rgba(30,77,183,.12) 70%, transparent);
        }

        .lr-form-block {
          max-width: 340px; width: 100%;
          opacity: 0; transform: translateX(20px);
          transition: opacity .65s ease .3s, transform .65s ease .3s;
        }
        .lr-form-block--in { opacity: 1; transform: translateX(0); }

        .lr-form-header { margin-bottom: 2rem; }
        .lr-form-title {
          font-size: 1.75rem; font-weight: 800;
          color: #0f1e38; letter-spacing: -.03em;
        }

        .lr-field { margin-bottom: 1.25rem; }
        .lr-label {
          display: block; font-size: .68rem; font-weight: 700;
          color: #4a6080; letter-spacing: .09em;
          text-transform: uppercase; margin-bottom: .45rem;
        }
        .lr-input-wrap { position: relative; display: flex; align-items: center; }
        .lr-input-icon {
          position: absolute; left: .875rem;
          color: #a0b4cc; display: flex; align-items: center; pointer-events: none;
        }
        .lr-input {
          width: 100%; padding: .8rem 1rem .8rem 2.5rem;
          border: 1.5px solid #dce6f0; border-radius: 10px;
          font-size: .88rem; font-family: inherit; color: #0f1e38;
          background: white; outline: none;
          transition: border-color .2s, box-shadow .2s;
        }
        .lr-input::placeholder { color: #b0c4d8; }
        .lr-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,.1);
        }
        .lr-pwd-toggle {
          position: absolute; right: .875rem;
          background: none; border: none; cursor: pointer;
          color: #a0b4cc; display: flex; align-items: center;
          padding: .2rem; transition: color .15s;
        }
        .lr-pwd-toggle:hover { color: #4a6080; }

        .lr-error {
          display: flex; align-items: center; gap: .5rem;
          padding: .65rem .875rem; margin-bottom: 1rem;
          background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 8px; color: #dc2626; font-size: .8rem;
        }

        .lr-btn {
          width: 100%; padding: .875rem 1.5rem;
          background: linear-gradient(135deg, #1e4db7, #2563eb);
          color: white; font-size: .9rem; font-weight: 700;
          font-family: inherit; letter-spacing: .01em;
          border: none; border-radius: 10px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 18px rgba(30,77,183,.35);
          transition: transform .15s, box-shadow .15s, opacity .15s;
          margin-top: .25rem;
        }
        .lr-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 26px rgba(30,77,183,.45);
        }
        .lr-btn:disabled { opacity: .45; cursor: not-allowed; }

        .lr-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: white; border-radius: 50%;
          animation: lr-spin .7s linear infinite;
        }
        @keyframes lr-spin { to { transform: rotate(360deg); } }

        .lr-info {
          margin-top: 1.5rem; padding: .875rem 1rem;
          background: #eef3fb; border-radius: 10px;
          border: 1px solid #dce6f0;
          font-size: .75rem; color: #6b87a8; line-height: 1.55;
        }
        .lr-info strong { color: #4a6080; }

        @keyframes lr-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .lr-root { flex-direction: column; overflow: auto; }
          .lr-left { flex: none; padding: 2rem; min-height: 44vh; }
          .lr-right { flex: none; padding: 2rem; }
          .lr-hero-title { font-size: 1.8rem; }
          .lr-form-block { max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
