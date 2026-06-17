/* =====================================================
   PILAH PILIH – DATABASE LAYER (sqlite3 async)
   ===================================================== */
'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'pilahpilih.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const _db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('[DB] Gagal buka database:', err.message);
  else console.log('[DB] Database terhubung:', DB_PATH);
});

_db.run('PRAGMA journal_mode = WAL');
_db.run('PRAGMA foreign_keys = ON');

/* UUID v4 */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* Promisified helpers */
const db = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      _db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      _db.get(sql, params, (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      _db.all(sql, params, (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      _db.exec(sql, (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }
};

/* ── Schema SQL ── */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE, password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', avatar TEXT, address TEXT, city TEXT,
    is_active INTEGER NOT NULL DEFAULT 1, is_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'bronze', xp INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0, total_sold_kg REAL NOT NULL DEFAULT 0,
    total_income INTEGER NOT NULL DEFAULT 0, total_pickups INTEGER NOT NULL DEFAULT 0,
    carbon_saved REAL NOT NULL DEFAULT 0, wallet_balance INTEGER NOT NULL DEFAULT 0,
    escrow_balance INTEGER NOT NULL DEFAULT 0,
    rank_pos INTEGER, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS waste_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT NOT NULL,
    price_per_kg INTEGER NOT NULL, description TEXT, is_active INTEGER NOT NULL DEFAULT 1,
    stock_kg REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    petugas_id TEXT REFERENCES users(id), category_id INTEGER REFERENCES waste_categories(id),
    waste_name TEXT NOT NULL, weight_kg REAL NOT NULL, price_per_kg INTEGER NOT NULL,
    total_price INTEGER NOT NULL, points_earned INTEGER NOT NULL DEFAULT 0,
    condition TEXT, address TEXT NOT NULL, latitude REAL, longitude REAL,
    pickup_date TEXT, pickup_time TEXT, notes TEXT, photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending', payment_method TEXT, paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS pengepul_transactions (
    id TEXT PRIMARY KEY, pengepul_id TEXT NOT NULL REFERENCES users(id),
    category_id INTEGER REFERENCES waste_categories(id),
    estimated_weight REAL NOT NULL, actual_weight REAL,
    price_per_kg INTEGER NOT NULL, total_price INTEGER NOT NULL,
    notes TEXT, status TEXT NOT NULL DEFAULT 'DRAFT',
    pickup_date TEXT, pickup_time TEXT, driver_name TEXT, vehicle_plate TEXT, pickup_notes TEXT,
    weight_difference REAL, photo_scale_url TEXT, photo_waste_url TEXT, verification_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS pickups (
    id TEXT PRIMARY KEY, transaction_id TEXT UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
    petugas_id TEXT REFERENCES users(id), user_id TEXT NOT NULL REFERENCES users(id),
    order_number TEXT UNIQUE NOT NULL, address TEXT NOT NULL,
    latitude REAL, longitude REAL, petugas_latitude REAL, petugas_longitude REAL,
    eta_minutes INTEGER, status TEXT NOT NULL DEFAULT 'waiting',
    assigned_at TEXT, arrived_at TEXT, completed_at TEXT, rating INTEGER, review TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT NOT NULL,
    category TEXT NOT NULL, cost_points INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 100,
    description TEXT, is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS reward_redemptions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id INTEGER NOT NULL REFERENCES rewards(id), cost_points INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    redeemed_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, amount INTEGER NOT NULL, description TEXT NOT NULL,
    reference TEXT, method TEXT, status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, body TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'info',
    is_read INTEGER NOT NULL DEFAULT 0, data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL REFERENCES waste_categories(id),
    price_per_kg INTEGER NOT NULL, changed_by TEXT REFERENCES users(id),
    changed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL,
    thumbnail TEXT, category TEXT NOT NULL DEFAULT 'tips', author_id TEXT REFERENCES users(id),
    views INTEGER NOT NULL DEFAULT 0, is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, identifier TEXT NOT NULL, code TEXT NOT NULL,
    purpose TEXT NOT NULL, expires_at TEXT NOT NULL, is_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, pickup_id TEXT NOT NULL REFERENCES pickups(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id), message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_pickups_status ON pickups(status);
  CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id);
  CREATE TABLE IF NOT EXISTS admin_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    petugas_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    method TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

/* Jalankan schema saat modul diload */
db.exec(SCHEMA)
  .then(async () => {
    console.log('✅ Database schema siap!');
    
    // Auto-migrate missing columns just in case
    db.exec("ALTER TABLE user_profiles ADD COLUMN escrow_balance INTEGER NOT NULL DEFAULT 0;").catch(()=>console.log("escrow_balance already exists"));
    db.exec("ALTER TABLE waste_categories ADD COLUMN stock_kg REAL NOT NULL DEFAULT 0;").catch(()=>console.log("stock_kg already exists"));
    
    // Auto-seed Demo Users
    const seedPwd = bcrypt.hashSync('password123', 10);
    const users = [
      { id: uuidv4(), name: 'Demo User',    email: 'user@pilahpilih.com',    role: 'user',        pass: seedPwd },
      { id: uuidv4(), name: 'Demo Petugas', email: 'petugas@pilahpilih.com', role: 'petugas',     pass: seedPwd },
      { id: uuidv4(), name: 'Demo Admin',   email: 'admin@pilahpilih.com',   role: 'admin',       pass: seedPwd },
      { id: uuidv4(), name: 'Demo Bank',    email: 'bank@pilahpilih.com',    role: 'bank_sampah', pass: seedPwd }
    ];
    
    for (const u of users) {
      const exist = await db.get('SELECT id FROM users WHERE email = ?', [u.email]);
      if (!exist) {
        await db.run(
          'INSERT INTO users (id, name, email, password, role, is_verified) VALUES (?,?,?,?,?,1)',
          [u.id, u.name, u.email, u.pass, u.role]
        );
        await db.run('INSERT INTO user_profiles (user_id) VALUES (?)', [u.id]);
        console.log('🌱 Seeded:', u.email);
      } else {
        // Pastikan password di-update ke hash yang valid
        await db.run('UPDATE users SET password = ?, is_verified = 1 WHERE email = ?', [seedPwd, u.email]);
      }
    }
  })
  .catch(e => console.error('❌ Schema error:', e.message));

module.exports = db;
module.exports.uuidv4 = uuidv4;
