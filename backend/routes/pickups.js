/* =====================================================
   ROUTES – Pickups & Tracking (async sqlite3)
   ===================================================== */
'use strict';
const router = require('express').Router();
const db = require('../database/db');
const { uuidv4 } = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

/* GET /api/pickups */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const isAdmin   = ['admin','bank_sampah'].includes(req.user.role);
    const isPetugas = req.user.role === 'petugas';

    let query = `
      SELECT pk.*, u.name as user_name, u.phone as user_phone,
             p.name as petugas_name, p.phone as petugas_phone,
             t.waste_name, t.weight_kg, t.total_price, t.points_earned,
             wc.name as category_name, wc.icon as category_icon
      FROM pickups pk
      LEFT JOIN users u ON pk.user_id = u.id
      LEFT JOIN users p ON pk.petugas_id = p.id
      LEFT JOIN transactions t ON pk.transaction_id = t.id
      LEFT JOIN waste_categories wc ON t.category_id = wc.id
      WHERE 1=1`;
    const params = [];
    if (!isAdmin) {
      if (isPetugas) { query += ' AND (pk.petugas_id = ? OR pk.status = "waiting")'; params.push(req.user.id); }
      else           { query += ' AND pk.user_id = ?'; params.push(req.user.id); }
    }
    if (status) { query += ' AND pk.status = ?'; params.push(status); }
    query += ' ORDER BY pk.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const pickups = await db.all(query, params);
    res.json({ success: true, data: pickups });
  } catch (err) { next(err); }
});

/* GET /api/pickups/stats */
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const isAdmin   = ['admin','bank_sampah'].includes(req.user.role);
    const isPetugas = req.user.role === 'petugas';
    let query = `SELECT status, COUNT(*) as count FROM pickups WHERE 1=1`;
    const params = [];
    if (!isAdmin) {
      if (isPetugas) {
        query += ' AND (petugas_id = ? OR status = "waiting")';
        params.push(req.user.id);
      } else {
        query += ' AND user_id = ?';
        params.push(req.user.id);
      }
    }
    query += ' GROUP BY status';
    const rows = await db.all(query, params);
    const result = { waiting: 0, completed: 0, confirmed: 0, on_way: 0, arrived: 0, weighing: 0 };
    rows.forEach(r => { if (result[r.status] !== undefined) result[r.status] = r.count; });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/* GET /api/pickups/:id */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const pickup = await db.get(
      `SELECT pk.*, u.name as user_name, u.phone as user_phone, u.avatar as user_avatar,
              p.name as petugas_name, p.phone as petugas_phone, p.avatar as petugas_avatar,
              t.waste_name, t.weight_kg, t.total_price, t.points_earned, t.notes, t.condition, t.payment_method,
              wc.name as category_name, wc.icon as category_icon
       FROM pickups pk
       LEFT JOIN users u ON pk.user_id = u.id
       LEFT JOIN users p ON pk.petugas_id = p.id
       LEFT JOIN transactions t ON pk.transaction_id = t.id
       LEFT JOIN waste_categories wc ON t.category_id = wc.id
       WHERE pk.id = ?`, [req.params.id]
    );
    if (!pickup) return res.status(404).json({ success: false, message: 'Pickup tidak ditemukan.' });
    const isAdmin = ['admin','bank_sampah'].includes(req.user.role);
    if (!isAdmin && pickup.user_id !== req.user.id && pickup.petugas_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const timeline = [
      { key: 'waiting',   label: 'Pesanan Masuk',        icon: '📋' },
      { key: 'confirmed', label: 'Petugas Ditugaskan',   icon: '👷' },
      { key: 'on_way',    label: 'Petugas Menuju Lokasi',icon: '🚛' },
      { key: 'arrived',   label: 'Tiba di Lokasi',       icon: '📍' },
      { key: 'weighing',  label: 'Proses Penimbangan',   icon: '⚖️' },
      { key: 'completed', label: 'Selesai',              icon: '✅' },
    ];
    const currentIdx = timeline.findIndex(t => t.key === pickup.status);
    const timelineWithStatus = timeline.map((t, i) => ({
      ...t, status: i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending'
    }));

    res.json({ success: true, data: { ...pickup, timeline: timelineWithStatus } });
  } catch (err) { next(err); }
});

/* PATCH /api/pickups/:id/accept — Petugas terima pickup */
router.patch('/:id/accept', authenticate, authorize('petugas'), async (req, res, next) => {
  try {
    const pickup = await db.get('SELECT * FROM pickups WHERE id = ? AND status = "waiting"', [req.params.id]);
    if (!pickup) return res.status(404).json({ success: false, message: 'Pickup tidak tersedia atau sudah diambil.' });

    const eta = Math.floor(Math.random() * 15) + 5;
    await db.run(
      `UPDATE pickups SET petugas_id=?, status='confirmed', assigned_at=datetime('now'), eta_minutes=?, updated_at=datetime('now') WHERE id=?`,
      [req.user.id, eta, req.params.id]
    );
    await db.run(
      `UPDATE transactions SET petugas_id=?, status='confirmed', updated_at=datetime('now') WHERE id=?`,
      [req.user.id, pickup.transaction_id]
    );
    await db.run(
      'INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)',
      [uuidv4(), pickup.user_id, '🚛 Petugas Ditemukan!', `Petugas dalam perjalanan. ETA: ~${eta} menit`, 'pickup']
    );

    res.json({ success: true, message: 'Pickup berhasil diterima.' });
  } catch (err) { next(err); }
});

/* PATCH /api/pickups/:id/reject — Petugas tolak pickup */
router.patch('/:id/reject', authenticate, authorize('petugas'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const pickup = await db.get('SELECT * FROM pickups WHERE id = ? AND status = "waiting"', [req.params.id]);
    if (!pickup) return res.status(404).json({ success: false, message: 'Pickup tidak ditemukan atau sudah diproses.' });

    // Reset back to waiting (so other petugas can pick it up), just log the rejection
    await db.run(
      'INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)',
      [uuidv4(), pickup.user_id,
       '⚠️ Pickup Belum Diterima',
       reason || 'Petugas tidak dapat menerima pesanan saat ini. Pesanan Anda masih aktif dan akan segera diproses petugas lain.',
       'info']
    );

    res.json({ success: true, message: 'Pickup ditolak. Pesanan masih aktif untuk petugas lain.' });
  } catch (err) { next(err); }
});

/* POST /api/pickups/:id/complete — Konfirmasi timbang selesai */
router.post('/:id/complete', authenticate, authorize('petugas', 'admin', 'bank_sampah'), async (req, res, next) => {
  try {
    const { weight_kg } = req.body;
    if (!weight_kg || weight_kg <= 0) return res.status(400).json({ success: false, message: 'Berat aktual diperlukan.' });

    const pickup = await db.get('SELECT * FROM pickups WHERE id = ?', [req.params.id]);
    if (!pickup) return res.status(404).json({ success: false, message: 'Pickup tidak ditemukan.' });

    const trx = await db.get('SELECT * FROM transactions WHERE id = ?', [pickup.transaction_id]);
    const actual_price  = Math.round(weight_kg * trx.price_per_kg);
    const actual_points = Math.round(actual_price / 200);

    const isCash = (trx.payment_method === 'cash');
    
    // Validasi saldo Petugas jika bukan tunai (wallet)
    if (!isCash && req.user.role === 'petugas') {
      const petugasProfile = await db.get('SELECT wallet_balance FROM user_profiles WHERE user_id = ?', [req.user.id]);
      if (!petugasProfile || petugasProfile.wallet_balance < actual_price) {
        return res.status(400).json({ success: false, message: 'Saldo dompet Anda tidak cukup untuk membayar User. Silakan Top Up.' });
      }
    }

    await db.run(
      `UPDATE transactions SET weight_kg=?, total_price=?, points_earned=?, status='completed', updated_at=datetime('now') WHERE id=?`,
      [weight_kg, actual_price, actual_points, trx.id]
    );
    await db.run(`UPDATE pickups SET status='completed', updated_at=datetime('now') WHERE id=?`, [req.params.id]);
    await db.run(`UPDATE waste_categories SET stock_kg = stock_kg + ? WHERE id=?`, [weight_kg, trx.category_id]);

    if (isCash) {
      await db.run(
        `UPDATE user_profiles SET points=points+?, xp=xp+?, total_sold_kg=total_sold_kg+?, total_income=total_income+?, total_pickups=total_pickups+1, carbon_saved=carbon_saved+?, updated_at=datetime('now') WHERE user_id=?`,
        [actual_points, actual_points, weight_kg, actual_price, weight_kg * 0.5, trx.user_id]
      );
      await db.run(
        'INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)',
        [uuidv4(), trx.user_id, '🎉 Penjualan Selesai (Tunai)!',
         `+${actual_points} poin dari ${trx.waste_name}. Pembayaran tunai Rp ${actual_price.toLocaleString('id-ID')} telah diterima.`, 'success']
      );
    } else {
      // Pembayaran Saldo (Wallet)
      if (req.user.role === 'petugas') {
        await db.run('UPDATE user_profiles SET wallet_balance = wallet_balance - ?, updated_at = datetime("now") WHERE user_id = ?', [actual_price, req.user.id]);
        await db.run(
          'INSERT INTO wallet_transactions (id,user_id,type,amount,description,reference) VALUES (?,?,?,?,?,?)',
          [uuidv4(), req.user.id, 'debit', actual_price, `Pembayaran ke User untuk ${trx.waste_name}`, trx.id]
        );
      }
      await db.run(
        `UPDATE user_profiles SET wallet_balance=wallet_balance+?, points=points+?, xp=xp+?,
         total_sold_kg=total_sold_kg+?, total_income=total_income+?, total_pickups=total_pickups+1,
         carbon_saved=carbon_saved+?, updated_at=datetime('now') WHERE user_id=?`,
        [actual_price, actual_points, actual_points, weight_kg, actual_price, weight_kg * 0.5, trx.user_id]
      );
      await db.run(
        'INSERT INTO wallet_transactions (id,user_id,type,amount,description,reference) VALUES (?,?,?,?,?,?)',
        [uuidv4(), trx.user_id, 'credit', actual_price,
         `Hasil penjualan aktual ${trx.waste_name} (${weight_kg} kg)`, trx.id]
      );
      await db.run(
        'INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)',
        [uuidv4(), trx.user_id, '🎉 Penjualan Selesai!',
         `+Rp ${actual_price.toLocaleString('id-ID')} & +${actual_points} poin dari ${trx.waste_name}`, 'success']
      );
    }

    res.json({ success: true, message: 'Penimbangan selesai!', data: { actual_price, weight_kg } });
  } catch (err) { next(err); }
});

/* PATCH /api/pickups/:id/status */
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status, petugas_latitude, petugas_longitude } = req.body;
    const pickup = await db.get('SELECT * FROM pickups WHERE id = ?', [req.params.id]);
    if (!pickup) return res.status(404).json({ success: false, message: 'Pickup tidak ditemukan.' });

    await db.run(
      `UPDATE pickups SET status=?, petugas_latitude=COALESCE(?,petugas_latitude),
       petugas_longitude=COALESCE(?,petugas_longitude), updated_at=datetime('now') WHERE id=?`,
      [status, petugas_latitude||null, petugas_longitude||null, req.params.id]
    );
    await db.run(`UPDATE transactions SET status=?, updated_at=datetime('now') WHERE id=?`,
      [status, pickup.transaction_id]);
    res.json({ success: true, message: `Status: ${status}` });
  } catch (err) { next(err); }
});

/* POST /api/pickups/:id/rate */
router.post('/:id/rate', authenticate, authorize('user'), async (req, res, next) => {
  try {
    const { rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating harus 1-5.' });
    const pickup = await db.get('SELECT * FROM pickups WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!pickup) return res.status(404).json({ success: false, message: 'Pickup tidak ditemukan.' });
    await db.run('UPDATE pickups SET rating=?, review=? WHERE id=?', [rating, review||null, req.params.id]);
    res.json({ success: true, message: 'Rating dikirim. Terima kasih!' });
  } catch (err) { next(err); }
});

/* GET /api/pickups/:id/location */
router.get('/:id/location', authenticate, async (req, res, next) => {
  try {
    const pickup = await db.get('SELECT petugas_latitude, petugas_longitude, eta_minutes, status FROM pickups WHERE id = ?', [req.params.id]);
    if (!pickup) return res.status(404).json({ success: false, message: 'Pickup tidak ditemukan.' });
    res.json({ success: true, data: {
      latitude:    pickup.petugas_latitude  || (0.5071 + (Math.random()-.5)*0.01),
      longitude:   pickup.petugas_longitude || (101.4451 + (Math.random()-.5)*0.01),
      eta_minutes: pickup.eta_minutes,
      status:      pickup.status
    }});
  } catch (err) { next(err); }
});

/* GET /api/pickups/:id/chat */
router.get('/:id/chat', authenticate, async (req, res, next) => {
  try {
    const messages = await db.all(
      `SELECT m.*, u.name as sender_name, u.role as sender_role, u.avatar as sender_avatar
       FROM messages m JOIN users u ON m.sender_id = u.id
       WHERE m.pickup_id = ? ORDER BY m.created_at ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
});

/* POST /api/pickups/:id/chat */
router.post('/:id/chat', authenticate, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong' });
    await db.run(
      'INSERT INTO messages (pickup_id, sender_id, message) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, message]
    );
    res.json({ success: true, message: 'Terkirim' });
  } catch (err) { next(err); }
});

module.exports = router;
