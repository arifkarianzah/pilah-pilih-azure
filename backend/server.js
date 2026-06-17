/* =====================================================
   PILAH PILIH – Main Server Entry Point
   Express REST API v1.0 – sqlite3 edition
   ===================================================== */
'use strict';

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const rateLimit = require('express-rate-limit');
const fs        = require('fs');

const PORT = process.env.PORT || 5000;

/* ── Upload folder ── */
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ── Init Database (schema dibuat saat modul diload) ── */
require('./database/db');

const app = express();

/* ── CORS ── */
app.use(cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

/* ── Rate Limiters ── */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5000,
  message: { success: false, message: 'Terlalu banyak request.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 500,
  message: { success: false, message: 'Terlalu banyak percobaan login.' }
});
app.use('/api/', apiLimiter);

/* ── Logger ── */
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const c = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
      console.log(`${c}[${res.statusCode}]\x1b[0m ${req.method} ${req.path} – ${Date.now()-start}ms`);
    });
    next();
  });
}

/* ── Routes ── */
app.use('/api/auth',          authLimiter, require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/transactions',  require('./routes/transactions'));
app.use('/api/pickups',       require('./routes/pickups'));
app.use('/api/categories',    require('./routes/categories'));
app.use('/api/rewards',       require('./routes/rewards'));
app.use('/api/wallet',        require('./routes/wallet'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/pengepul',      require('./routes/pengepul'));

/* ── Root ── */
app.get('/', (req, res) => res.json({
  app: 'Pilah Pilih API', version: '1.0.0', status: 'running',
  docs: `http://localhost:${PORT}/api/docs`
}));
app.get('/api/health', (req, res) => res.json({
  status: 'ok', uptime: process.uptime(), ts: new Date().toISOString()
}));
app.get('/api/docs', (req, res) => res.json({
  title: 'Pilah Pilih REST API v1.0',
  base_url: `http://localhost:${PORT}/api`,
  note: 'Gunakan Authorization: Bearer <token> untuk endpoint yang butuh auth',
  endpoints: {
    'POST /auth/register':             'Daftar akun baru',
    'POST /auth/login':                'Login → JWT token',
    'POST /auth/send-otp':             'Kirim OTP',
    'POST /auth/verify-otp':           'Verifikasi OTP',
    'GET  /auth/me':                   '[Auth] Info saya',
    'GET  /categories':                'Semua kategori + harga',
    'GET  /categories/prices/latest':  'Harga terkini',
    'POST /transactions':              '[User] Buat order pickup',
    'GET  /transactions':              '[Auth] Riwayat transaksi',
    'GET  /transactions/:id':          '[Auth] Detail transaksi',
    'PATCH /transactions/:id/status':  'Update status transaksi',
    'DELETE /transactions/:id':        '[User] Batalkan order',
    'GET  /pickups':                   '[Auth] Daftar pickup',
    'GET  /pickups/:id':               '[Auth] Detail + timeline',
    'PATCH /pickups/:id/accept':       '[Petugas] Terima pickup',
    'POST /pickups/:id/rate':          '[User] Rating petugas',
    'GET  /pickups/:id/location':      '[User] Lokasi petugas',
    'GET  /rewards':                   '[Auth] Katalog reward',
    'POST /rewards/:id/redeem':        '[User] Tukar poin',
    'GET  /wallet/balance':            '[Auth] Saldo wallet',
    'POST /wallet/withdraw':           '[User] Tarik dana',
    'GET  /notifications':             '[Auth] Notifikasi',
    'GET  /admin/dashboard':           '[Admin] Dashboard',
    'GET  /admin/reports':             '[Admin] Laporan detail',
  }
}));

/* ── Error Handlers ── */
const { errorHandler, notFound } = require('./middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

/* ── Start ── */
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   🌱  PILAH PILIH API SERVER  v1.0.0    ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║   🚀 URL  : http://localhost:${PORT}           ║`);
  console.log(`║   📋 Docs : http://localhost:${PORT}/api/docs  ║`);
  console.log(`║   🔧 Env  : ${(process.env.NODE_ENV||'development').padEnd(30)}║`);
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('  Akun test (setelah npm run seed):');
  console.log('  rizki@example.com / password123  (user)');
  console.log('  admin@pilahpilih.id / admin2025   (admin)\n');
});

module.exports = app;
