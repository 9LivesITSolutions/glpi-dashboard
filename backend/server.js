require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { bootstrap } = require('./db/bootstrap');

const app = express();

// ── Middlewares globaux ───────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/setup', require('./routes/setup'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/resolution', require('./routes/resolution'));
app.use('/api/techniciens', require('./routes/techniciens'));
app.use('/api/sla', require('./routes/sla'));
app.use('/api/technicien-stats', require('./routes/technicienStats'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/debug', require('./routes/debug'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Gestion des erreurs globales ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message || 'Erreur interne du serveur' });
});

// ── Démarrage ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await bootstrap();
    app.listen(PORT, () => {
      console.log(`🚀 GLPI Dashboard API démarré sur http://localhost:${PORT}`);
      console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ Impossible de démarrer le serveur :', err.message);
    console.error('   Vérifiez la configuration APP_DB_* dans votre .env');
    process.exit(1);
  }
}

start();
