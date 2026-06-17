/* =====================================================
   ROUTES – Transactions (async/await sqlite3)
   ===================================================== */
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const db = require('../database/db');
const { uuidv4 } = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');

function genOrderNum() {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `ORD-${date}-${String(Math.floor(Math.random() * 9000)+1000)}`;
}

/* POST /api/transactions */
router.post('/', authenticate, authorize('user'),
  [
    body('waste_name').trim().notEmpty().withMessage('Nama sampah wajib'),
    body('category_id').isInt({ min: 1 }).withMessage('Pilih kategori'),
    body('weight_kg').isFloat({ min: 0.1 }).withMessage('Berat minimal 0.1 kg'),
    body('address').trim().notEmpty().withMessage('Alamat wajib'),
    body('condition').isIn(['bersih','kotor','campuran']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { waste_name, category_id, weight_kg, address, condition, notes, pickup_date, pickup_time, latitude, longitude, payment_method } = req.body;
      const cat = await db.get('SELECT * FROM waste_categories WHERE id = ? AND is_active = 1', [category_id]);
      if (!cat) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });

      const price_per_kg  = cat.price_per_kg;
      const total_price   = Math.round(weight_kg * price_per_kg);
      const points_earned = Math.round(total_price / 200);
      const trxId  = uuidv4();
      const pkpId  = uuidv4();
      const pm = payment_method || 'wallet';

      await db.run(
        `INSERT INTO transactions (id,user_id,category_id,waste_name,weight_kg,price_per_kg,total_price,points_earned,condition,address,latitude,longitude,notes,pickup_date,pickup_time,payment_method)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [trxId, req.user.id, category_id, waste_name, weight_kg, price_per_kg, total_price, points_earned,
         condition, address, latitude||null, longitude||null, notes||null, pickup_date||null, pickup_time||null, pm]
      );
      await db.run(
        `INSERT INTO pickups (id,transaction_id,user_id,order_number,address,latitude,longitude)
         VALUES (?,?,?,?,?,?,?)`,
        [pkpId, trxId, req.user.id, genOrderNum(), address, latitude||null, longitude||null]
      );
      await db.run(
        'INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)',
        [uuidv4(), req.user.id, '✅ Pesanan Diterima',
         `${waste_name} (${weight_kg} kg) – Est. Rp ${total_price.toLocaleString('id-ID')}`, 'pickup']
      );

      const trx = await db.get('SELECT * FROM transactions WHERE id = ?', [trxId]);
      res.status(201).json({ success: true, message: 'Pesanan berhasil dibuat!', data: trx });
    } catch (err) { next(err); }
  }
);

/* GET /api/transactions */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    const isAdmin   = ['admin','bank_sampah'].includes(req.user.role);
    const isPetugas = req.user.role === 'petugas';

    let query = `
      SELECT t.*, u.name as user_name, u.phone as user_phone,
             c.name as category_name, c.icon as category_icon, p.name as petugas_name
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN waste_categories c ON t.category_id = c.id
      LEFT JOIN users p ON t.petugas_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (!isAdmin) {
      if (isPetugas) { query += ' AND (t.petugas_id = ? OR t.status = "pending")'; params.push(req.user.id); }
      else           { query += ' AND t.user_id = ?'; params.push(req.user.id); }
    }
    if (status) { query += ' AND t.status = ?'; params.push(status); }
    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const transactions = await db.all(query, params);
    const total = (await db.get('SELECT COUNT(*) as c FROM transactions')).c;
    res.json({ success: true, data: transactions,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total/limit) } });
  } catch (err) { next(err); }
});

/* GET /api/transactions/:id */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const trx = await db.get(
      `SELECT t.*, u.name as user_name, c.name as category_name, c.icon,
              p.name as petugas_name, pk.order_number, pk.status as pickup_status, pk.eta_minutes, pk.rating, pk.review
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN waste_categories c ON t.category_id = c.id
       LEFT JOIN users p ON t.petugas_id = p.id
       LEFT JOIN pickups pk ON t.id = pk.transaction_id
       WHERE t.id = ?`, [req.params.id]
    );
    if (!trx) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    const isAdmin = ['admin','bank_sampah'].includes(req.user.role);
    if (!isAdmin && trx.user_id !== req.user.id && trx.petugas_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }
    res.json({ success: true, data: trx });
  } catch (err) { next(err); }
});

/* PATCH /api/transactions/:id/status */
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatus = ['pending','confirmed','on_way','arrived','weighing','completed','cancelled'];
    if (!validStatus.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid.' });

    const trx = await db.get('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (!trx) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    if (status === 'completed' && req.user.role === 'petugas') {
      const isCash = (trx.payment_method === 'cash');
      if (!isCash) {
        const petugasProfile = await db.get('SELECT wallet_balance FROM user_profiles WHERE user_id = ?', [req.user.id]);
        if (!petugasProfile || petugasProfile.wallet_balance < trx.total_price) {
          return res.status(400).json({ success: false, message: 'Saldo dompet Anda tidak cukup untuk membayar User. Silakan Top Up.' });
        }
      }
    }

    await db.run(`UPDATE transactions SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, trx.id]);
    await db.run(`UPDATE pickups SET status = ?, updated_at = datetime('now') WHERE transaction_id = ?`, [status, trx.id]);

    if (status === 'completed') {
      const isCash = (trx.payment_method === 'cash');
      
      if (isCash) {
        await db.run(
          `UPDATE user_profiles SET points=points+?, xp=xp+?, total_sold_kg=total_sold_kg+?, total_income=total_income+?, total_pickups=total_pickups+1, carbon_saved=carbon_saved+?, updated_at=datetime('now') WHERE user_id=?`,
          [trx.points_earned, trx.points_earned, trx.weight_kg, trx.total_price, trx.weight_kg * 0.5, trx.user_id]
        );
        await db.run(
          'INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)',
          [uuidv4(), trx.user_id, '🎉 Penjualan Selesai (Tunai)!',
           `+${trx.points_earned} poin dari ${trx.waste_name}. Pembayaran tunai Rp ${trx.total_price.toLocaleString('id-ID')} telah diterima.`, 'success']
        );
      } else {
        // Deduct Petugas Wallet
        if (req.user.role === 'petugas') {
          await db.run('UPDATE user_profiles SET wallet_balance = wallet_balance - ?, updated_at = datetime("now") WHERE user_id = ?', [trx.total_price, req.user.id]);
          await db.run(
            'INSERT INTO wallet_transactions (id,user_id,type,amount,description,reference) VALUES (?,?,?,?,?,?)',
            [uuidv4(), req.user.id, 'debit', trx.total_price, `Pembayaran ke User untuk ${trx.waste_name}`, trx.id]
          );
        }
        
        // Add to User Wallet
        await db.run(
          `UPDATE user_profiles SET wallet_balance=wallet_balance+?, points=points+?, xp=xp+?, total_sold_kg=total_sold_kg+?, total_income=total_income+?, total_pickups=total_pickups+1, carbon_saved=carbon_saved+?, updated_at=datetime('now') WHERE user_id=?`,
          [trx.total_price, trx.points_earned, trx.points_earned, trx.weight_kg, trx.total_price, trx.weight_kg * 0.5, trx.user_id]
        );
        await db.run(
          'INSERT INTO wallet_transactions (id,user_id,type,amount,description,reference) VALUES (?,?,?,?,?,?)',
          [uuidv4(), trx.user_id, 'credit', trx.total_price, `Hasil penjualan ${trx.waste_name} (${trx.weight_kg} kg)`, trx.id]
        );
        await db.run(
          'INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)',
          [uuidv4(), trx.user_id, '🎉 Penjualan Selesai!',
           `+Rp ${trx.total_price.toLocaleString('id-ID')} & +${trx.points_earned} poin dari ${trx.waste_name}`, 'success']
        );
      }
    }
    res.json({ success: true, message: `Status diperbarui: ${status}` });
  } catch (err) { next(err); }
});

/* DELETE /api/transactions/:id */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const trx = await db.get('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!trx) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    if (!['pending','confirmed'].includes(trx.status)) {
      return res.status(400).json({ success: false, message: 'Tidak dapat dibatalkan.' });
    }
    await db.run(`UPDATE transactions SET status='cancelled', updated_at=datetime('now') WHERE id=?`, [trx.id]);
    await db.run(`UPDATE pickups SET status='cancelled', updated_at=datetime('now') WHERE transaction_id=?`, [trx.id]);
    res.json({ success: true, message: 'Pesanan berhasil dibatalkan.' });
  } catch (err) { next(err); }
});

module.exports = router;
