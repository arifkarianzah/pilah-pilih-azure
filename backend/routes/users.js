/* =====================================================
   ROUTES – Users & Profiles (async/await sqlite3)
   ===================================================== */
'use strict';

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');

function safeUser(u) { if (!u) return null; const { password, ...s } = u; return s; }

/* GET /api/users/profile */
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const user    = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const profile = await db.get('SELECT * FROM user_profiles WHERE user_id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    res.json({ success: true, data: { ...safeUser(user), profile } });
  } catch (err) { next(err); }
});

/* PUT /api/users/profile */
router.put('/profile', authenticate,
  [
    body('name').optional().trim().isLength({ min: 2 }),
    body('phone').optional(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, phone, address, city, avatar } = req.body;
      await db.run(
        `UPDATE users SET name = COALESCE(?,name), phone = COALESCE(?,phone),
         address = COALESCE(?,address), city = COALESCE(?,city), avatar = COALESCE(?,avatar),
         updated_at = NOW() WHERE id = ?`,
        [name||null, phone||null, address||null, city||null, avatar||null, req.user.id]
      );
      const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
      res.json({ success: true, message: 'Profil diperbarui.', data: safeUser(updated) });
    } catch (err) { next(err); }
  }
);

/* PUT /api/users/change-password */
router.put('/change-password', authenticate,
  [
    body('old_password').notEmpty(),
    body('new_password').isLength({ min: 8 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { old_password, new_password } = req.body;
      const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
      if (!bcrypt.compareSync(old_password, user.password)) {
        return res.status(400).json({ success: false, message: 'Password lama salah.' });
      }
      await db.run('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
        [bcrypt.hashSync(new_password, 12), req.user.id]);
      res.json({ success: true, message: 'Password berhasil diubah.' });
    } catch (err) { next(err); }
  }
);

/* POST /api/users/topup */
router.post('/topup', authenticate, async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 10000) {
      return res.status(400).json({ success: false, message: 'Minimal top up adalah Rp 10.000' });
    }
    
    // Add to user_profiles
    await db.run(
      'UPDATE user_profiles SET wallet_balance = wallet_balance + ?, updated_at = NOW() WHERE user_id = ?',
      [amount, req.user.id]
    );
    
    // Record in wallet_transactions (requires uuidv4 so we might need to require it if not imported, but wait we can use a simple trick or import it)
    // Actually, sqlite can generate UUIDs or we can just use a simple string, but let's use require('uuid') or just a random hex
    const crypto = require('crypto');
    const txId = crypto.randomUUID();
    
    await db.run(
      'INSERT INTO wallet_transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)',
      [txId, req.user.id, 'credit', amount, 'Top Up Saldo Dompet']
    );

    res.json({ success: true, message: 'Top up berhasil', data: { amount } });
  } catch (err) { next(err); }
});

/* GET /api/users/stats */
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const profile  = await db.get('SELECT * FROM user_profiles WHERE user_id = ?', [req.user.id]);
    const trxCount = await db.get(
      `SELECT COUNT(*) as total,
       SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status IN ('pending','on_way') THEN 1 ELSE 0 END) as active
       FROM transactions WHERE user_id = ?`, [req.user.id]
    );
    res.json({ success: true, data: { profile, transactions: trxCount } });
  } catch (err) { next(err); }
});

/* GET /api/users/leaderboard */
router.get('/leaderboard', authenticate, async (req, res, next) => {
  try {
    const top = await db.all(
      `SELECT u.name, u.avatar, p.level, p.points, p.total_sold_kg, p.rank_pos
       FROM users u JOIN user_profiles p ON u.id = p.user_id
       WHERE u.role = 'user' ORDER BY p.points DESC LIMIT 20`
    );
    res.json({ success: true, data: top });
  } catch (err) { next(err); }
});

/* GET /api/users (Admin) */
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const offset = (page - 1) * limit;
    let query = 'SELECT u.*, p.level, p.points, p.wallet_balance FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id WHERE 1=1';
    const params = [];
    if (role)   { query += ' AND u.role = ?'; params.push(role); }
    if (search) { query += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const users = await db.all(query, params);
    const total = (await db.get('SELECT COUNT(*) as c FROM users')).c;
    res.json({
      success: true,
      data: users.map(u => safeUser(u)),
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total/limit) }
    });
  } catch (err) { next(err); }
});

/* PATCH /api/users/:id/status (Admin) */
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { is_active } = req.body;
    await db.run('UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [is_active ? 1 : 0, req.params.id]);
    res.json({ success: true, message: `User berhasil di${is_active?'aktifkan':'nonaktifkan'}.` });
  } catch (err) { next(err); }
});

module.exports = router;
