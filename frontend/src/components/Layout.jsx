import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { id: 'dashboard', label: '📊 Vue globale' },
  { id: 'technicien', label: '👤 Stats technicien' },
];

export default function Layout({ children, activeView, onViewChange }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-2xl">📊</span>
            <div>
              <span className="font-bold text-gray-800 text-sm leading-none">GLPI Dashboard</span>
              <span className="block text-[10px] text-gray-400 leading-none">Helpdesk Analytics</span>
            </div>
          </div>

          {onViewChange && (
            <nav className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                    activeView === item.id
                      ? 'bg-white shadow text-brand-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-7 h-7 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {user?.username?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-700 leading-none">{user?.username}</p>
                <p className="text-xs text-gray-400 leading-none capitalize">{user?.role} · {user?.auth_type}</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-10 w-52 bg-white rounded-xl shadow-lg border border-gray-200 z-40 py-1">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-800">{user?.username}</p>
                    <p className="text-xs text-gray-500">{user?.auth_type === 'ldap' ? '🔗 LDAP' : '👤 Local'} · {user?.role}</p>
                  </div>
                  {user?.role === 'admin' && onViewChange && (
                    <button
                      onClick={() => { onViewChange('admin'); setMenuOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        activeView === 'admin' ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      ⚙️ Administration
                    </button>
                  )}
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    🚪 Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">
        {children}
      </main>

      <footer className="text-center py-3 text-xs text-gray-400 border-t border-gray-100">
        GLPI Dashboard — données en lecture seule
      </footer>
    </div>
  );
}
