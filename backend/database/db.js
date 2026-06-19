/* =====================================================
   PILAH PILIH – DATABASE LAYER (MySQL)
   ===================================================== */
'use strict';

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'pilah_pilih_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true, // Required for executing multiple schema creation queries
  ssl: process.env.DB_HOST && process.env.DB_HOST.includes('azure.com') ? { rejectUnauthorized: false } : undefined
});

pool.getConnection()
  .then(conn => {
    console.log('[DB] Database terhubung ke MySQL:', process.env.DB_NAME);
    conn.release();
  })
  .catch(err => {
    console.error('[DB] Gagal koneksi ke MySQL. Pastikan database server jalan dan database sudah dibuat. Error:', err.message);
  });

/* UUID v4 */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* Promisified helpers - wrapper agar sesuai dengan usage SQLite lama */
const db = {
  async run(sql, params = []) {
    const [result] = await pool.query(sql, params);
    return { lastID: result.insertId, changes: result.affectedRows };
  },
  async get(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows.length > 0 ? rows[0] : undefined;
  },
  async all(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
  },
  async exec(sql) {
    await pool.query(sql);
  }
};

/* ── Schema SQL (MySQL Dialect) ── */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY, 
    name VARCHAR(255) NOT NULL, 
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) UNIQUE, 
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user', 
    avatar VARCHAR(255), 
    address TEXT, 
    city VARCHAR(100),
    is_active TINYINT(1) NOT NULL DEFAULT 1, 
    is_verified TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(255) PRIMARY KEY,
    level VARCHAR(50) NOT NULL DEFAULT 'bronze', 
    xp INT NOT NULL DEFAULT 0,
    points INT NOT NULL DEFAULT 0, 
    total_sold_kg DOUBLE NOT NULL DEFAULT 0,
    total_income INT NOT NULL DEFAULT 0, 
    total_pickups INT NOT NULL DEFAULT 0,
    carbon_saved DOUBLE NOT NULL DEFAULT 0, 
    wallet_balance INT NOT NULL DEFAULT 0,
    escrow_balance INT NOT NULL DEFAULT 0,
    rank_pos INT, 
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS waste_categories (
    id INT AUTO_INCREMENT PRIMARY KEY, 
    name VARCHAR(255) NOT NULL, 
    icon VARCHAR(255) NOT NULL,
    price_per_kg INT NOT NULL, 
    description TEXT, 
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    stock_kg DOUBLE NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(255) PRIMARY KEY, 
    user_id VARCHAR(255) NOT NULL,
    petugas_id VARCHAR(255), 
    category_id INT,
    waste_name VARCHAR(255) NOT NULL, 
    weight_kg DOUBLE NOT NULL, 
    price_per_kg INT NOT NULL,
    total_price INT NOT NULL, 
    points_earned INT NOT NULL DEFAULT 0,
    \`condition\` VARCHAR(255), 
    address TEXT NOT NULL, 
    latitude DOUBLE, 
    longitude DOUBLE,
    pickup_date VARCHAR(50), 
    pickup_time VARCHAR(50), 
    notes TEXT, 
    photo_url VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', 
    payment_method VARCHAR(100), 
    paid_at VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (petugas_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES waste_categories(id)
  );
  CREATE TABLE IF NOT EXISTS pengepul_transactions (
    id VARCHAR(255) PRIMARY KEY, 
    pengepul_id VARCHAR(255) NOT NULL,
    category_id INT,
    estimated_weight DOUBLE NOT NULL, 
    actual_weight DOUBLE,
    price_per_kg INT NOT NULL, 
    total_price INT NOT NULL,
    notes TEXT, 
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    pickup_date VARCHAR(50), 
    pickup_time VARCHAR(50), 
    driver_name VARCHAR(255), 
    vehicle_plate VARCHAR(50), 
    pickup_notes TEXT,
    weight_difference DOUBLE, 
    photo_scale_url VARCHAR(255), 
    photo_waste_url VARCHAR(255), 
    verification_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pengepul_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES waste_categories(id)
  );
  CREATE TABLE IF NOT EXISTS pickups (
    id VARCHAR(255) PRIMARY KEY, 
    transaction_id VARCHAR(255) UNIQUE,
    petugas_id VARCHAR(255), 
    user_id VARCHAR(255) NOT NULL,
    order_number VARCHAR(100) UNIQUE NOT NULL, 
    address TEXT NOT NULL,
    latitude DOUBLE, 
    longitude DOUBLE, 
    petugas_latitude DOUBLE, 
    petugas_longitude DOUBLE,
    eta_minutes INT, 
    status VARCHAR(50) NOT NULL DEFAULT 'waiting',
    assigned_at TIMESTAMP NULL, 
    arrived_at TIMESTAMP NULL, 
    completed_at TIMESTAMP NULL, 
    rating INT, 
    review TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (petugas_id) REFERENCES users(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS rewards (
    id INT AUTO_INCREMENT PRIMARY KEY, 
    name VARCHAR(255) NOT NULL, 
    icon VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, 
    cost_points INT NOT NULL, 
    stock INT NOT NULL DEFAULT 100,
    description TEXT, 
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS reward_redemptions (
    id VARCHAR(255) PRIMARY KEY, 
    user_id VARCHAR(255) NOT NULL,
    reward_id INT NOT NULL, 
    cost_points INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    redeemed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reward_id) REFERENCES rewards(id)
  );
  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id VARCHAR(255) PRIMARY KEY, 
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, 
    amount INT NOT NULL, 
    description VARCHAR(255) NOT NULL,
    reference VARCHAR(255), 
    method VARCHAR(50), 
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(255) PRIMARY KEY, 
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL, 
    body TEXT NOT NULL, 
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    is_read TINYINT(1) NOT NULL DEFAULT 0, 
    data TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS price_history (
    id INT AUTO_INCREMENT PRIMARY KEY, 
    category_id INT NOT NULL,
    price_per_kg INT NOT NULL, 
    changed_by VARCHAR(255),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES waste_categories(id),
    FOREIGN KEY (changed_by) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS articles (
    id INT AUTO_INCREMENT PRIMARY KEY, 
    title VARCHAR(255) NOT NULL, 
    content TEXT NOT NULL,
    thumbnail VARCHAR(255), 
    category VARCHAR(100) NOT NULL DEFAULT 'tips', 
    author_id VARCHAR(255),
    views INT NOT NULL DEFAULT 0, 
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS otp_codes (
    id INT AUTO_INCREMENT PRIMARY KEY, 
    identifier VARCHAR(255) NOT NULL, 
    code VARCHAR(50) NOT NULL,
    purpose VARCHAR(50) NOT NULL, 
    expires_at TIMESTAMP NOT NULL, 
    is_used TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY, 
    pickup_id VARCHAR(255) NOT NULL,
    sender_id VARCHAR(255) NOT NULL, 
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pickup_id) REFERENCES pickups(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS admin_income (
    id INT AUTO_INCREMENT PRIMARY KEY,
    petugas_id VARCHAR(255),
    amount INT NOT NULL,
    description TEXT,
    method VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (petugas_id) REFERENCES users(id) ON DELETE SET NULL
  );
`;

/* Jalankan schema saat modul diload */
db.exec(SCHEMA)
  .then(async () => {
    console.log('✅ Database schema siap!');
    
    try { await db.exec("ALTER TABLE user_profiles ADD COLUMN escrow_balance INT NOT NULL DEFAULT 0;"); } catch(e){}
    try { await db.exec("ALTER TABLE waste_categories ADD COLUMN stock_kg DOUBLE NOT NULL DEFAULT 0;"); } catch(e){}
    
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
        await db.run('UPDATE users SET password = ?, is_verified = 1 WHERE email = ?', [seedPwd, u.email]);
      }
    }

    // Auto-seed Categories
    const categoriesCount = await db.get('SELECT COUNT(*) as c FROM waste_categories');
    if (categoriesCount && categoriesCount.c === 0) {
      await db.run('ALTER TABLE waste_categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
      const defaultCategories = [
        { name: 'Kertas & Kardus', icon: '📦', price: 2500, desc: 'Buku, koran, kardus bekas.' },
        { name: 'Botol Plastik', icon: '🍾', price: 3000, desc: 'Botol air mineral, botol minuman.' },
        { name: 'Besi & Logam', icon: '⚙️', price: 5000, desc: 'Kaleng, paku, pipa besi bekas.' },
        { name: 'Kaca & Beling', icon: '🥃', price: 1000, desc: 'Botol kaca, pecahan kaca.' }
      ];
      for (const cat of defaultCategories) {
        await db.run(
          'INSERT INTO waste_categories (name, icon, price_per_kg, description) VALUES (?, ?, ?, ?)',
          [cat.name, cat.icon, cat.price, cat.desc]
        );
      }
      console.log('🌱 Seeded waste categories');
    }
  })
  .catch(e => console.error('❌ Schema error:', e.message));

module.exports = db;
module.exports.uuidv4 = uuidv4;
