'use strict';
const router = require('express').Router();
const db = require('../database/db');
const { uuidv4 } = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/pengepul/transactions (Get list of pengepul transactions)
router.get('/transactions', authenticate, authorize('bank_sampah', 'admin'), async (req, res, next) => {
  try {
    const data = await db.all(
      `SELECT pt.*, c.name as category_name, c.icon as category_icon, u.name as pengepul_name 
       FROM pengepul_transactions pt 
       LEFT JOIN waste_categories c ON pt.category_id = c.id
       LEFT JOIN users u ON pt.pengepul_id = u.id
       WHERE pt.pengepul_id = ? OR ? = 'admin'
       ORDER BY pt.created_at DESC`,
      [req.user.id, req.user.role]
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/pengepul/transactions (Ajukan Pembelian / Buy stock)
router.post('/transactions', authenticate, authorize('bank_sampah'), async (req, res, next) => {
  try {
    const { category_id, estimated_weight, price_per_kg, is_draft } = req.body;
    const total_price = estimated_weight * price_per_kg;

    const profile = await db.get('SELECT wallet_balance FROM user_profiles WHERE user_id = ?', [req.user.id]);
    
    // Validasi saldo
    if (!is_draft && profile.wallet_balance < total_price) {
      return res.status(400).json({ success: false, message: 'Saldo Tidak Mencukupi' });
    }

    const id = uuidv4();
    const status = is_draft ? 'DRAFT' : 'PENGAJUAN';

    await db.run(
      `INSERT INTO pengepul_transactions (id, pengepul_id, category_id, estimated_weight, price_per_kg, total_price, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, category_id, estimated_weight, price_per_kg, total_price, status]
    );

    if (!is_draft) {
      // Escrow: kurangi wallet_balance, tambah escrow_balance
      await db.run(
        `UPDATE user_profiles SET wallet_balance = wallet_balance - ?, escrow_balance = escrow_balance + ? WHERE user_id = ?`,
        [total_price, total_price, req.user.id]
      );
    }

    res.json({ success: true, message: is_draft ? 'Draft disimpan' : 'Pengajuan berhasil', data: { id } });
  } catch (err) { next(err); }
});

// PATCH /api/pengepul/transactions/:id/status (Admin Setujui)
router.patch('/transactions/:id/status', authenticate, authorize('admin', 'bank_sampah'), async (req, res, next) => {
  try {
    const { status } = req.body; // PERSETUJUAN, DANA_DITAHAN, DITERIMA, SELESAI
    const trx = await db.get('SELECT * FROM pengepul_transactions WHERE id = ?', [req.params.id]);
    if (!trx) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

    await db.run('UPDATE pengepul_transactions SET status = ?, updated_at = datetime("now") WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Status berhasil diubah' });
  } catch (err) { next(err); }
});

// POST /api/pengepul/transactions/:id/schedule (Pengepul Mengatur Pickup)
router.post('/transactions/:id/schedule', authenticate, authorize('bank_sampah', 'admin'), async (req, res, next) => {
  try {
    const { pickup_date, pickup_time, driver_name, vehicle_plate, pickup_notes } = req.body;
    await db.run(
      `UPDATE pengepul_transactions SET pickup_date = ?, pickup_time = ?, driver_name = ?, vehicle_plate = ?, pickup_notes = ?, status = 'DIJADWALKAN', updated_at = datetime("now") WHERE id = ?`,
      [pickup_date, pickup_time, driver_name, vehicle_plate, pickup_notes, req.params.id]
    );
    res.json({ success: true, message: 'Jadwal berhasil diatur' });
  } catch (err) { next(err); }
});

// POST /api/pengepul/transactions/:id/verify (Timbang Ulang & Verifikasi)
router.post('/transactions/:id/verify', authenticate, authorize('admin', 'bank_sampah'), async (req, res, next) => {
  try {
    const { actual_weight, verification_notes } = req.body;
    const trx = await db.get('SELECT * FROM pengepul_transactions WHERE id = ?', [req.params.id]);
    
    const weight_difference = actual_weight - trx.estimated_weight;
    
    // Jika selisih > 10%, status PERLU VERIFIKASI ADMIN, kalau aman DIVERIFIKASI
    const diffPercent = Math.abs(weight_difference / trx.estimated_weight) * 100;
    const status = diffPercent > 10 ? 'PERLU_VERIFIKASI_ADMIN' : 'DIVERIFIKASI';

    await db.run(
      `UPDATE pengepul_transactions SET actual_weight = ?, weight_difference = ?, verification_notes = ?, status = ?, updated_at = datetime("now") WHERE id = ?`,
      [actual_weight, weight_difference, verification_notes, status, req.params.id]
    );
    res.json({ success: true, message: 'Verifikasi berhasil', data: { status, weight_difference } });
  } catch (err) { next(err); }
});

// POST /api/pengepul/transactions/:id/pay (Transfer Dana ke Admin System)
router.post('/transactions/:id/pay', authenticate, authorize('admin', 'bank_sampah'), async (req, res, next) => {
  try {
    const trx = await db.get('SELECT * FROM pengepul_transactions WHERE id = ?', [req.params.id]);
    if (!trx) return res.status(404).json({ success: false, message: 'Tidak ditemukan' });

    // Use actual weight if available, otherwise estimated
    const finalWeight = trx.actual_weight || trx.estimated_weight;
    const totalBayar = finalWeight * trx.price_per_kg;

    // Kurangi escrow balance pengepul (sebesar harga estimasi awal)
    await db.run('UPDATE user_profiles SET escrow_balance = escrow_balance - ? WHERE user_id = ?', [trx.total_price, trx.pengepul_id]);

    // Jika harga final kurang dari estimasi awal, kembalikan sisa ke wallet pengepul
    if (totalBayar < trx.total_price) {
      const diff = trx.total_price - totalBayar;
      await db.run('UPDATE user_profiles SET wallet_balance = wallet_balance + ? WHERE user_id = ?', [diff, trx.pengepul_id]);
    } else if (totalBayar > trx.total_price) {
      // Jika harga final lebih besar, potong dari wallet balance lagi
      const diff = totalBayar - trx.total_price;
      await db.run('UPDATE user_profiles SET wallet_balance = wallet_balance - ? WHERE user_id = ?', [diff, trx.pengepul_id]);
    }

    // Kurangi stock_kg dari waste_categories
    await db.run('UPDATE waste_categories SET stock_kg = stock_kg - ? WHERE id = ?', [finalWeight, trx.category_id]);

    await db.run('UPDATE pengepul_transactions SET status = "DIBAYAR", updated_at = datetime("now") WHERE id = ?', [req.params.id]);
    
    // Catat mutasi wallet pengepul
    await db.run(
      'INSERT INTO wallet_transactions (id,user_id,type,amount,description,status) VALUES (?,?,?,?,?,?)',
      [uuidv4(), trx.pengepul_id, 'debit', totalBayar, `Pembelian sampah (No. ${trx.id.substring(0,8).toUpperCase()})`, 'completed']
    );

    res.json({ success: true, message: 'Pembayaran selesai. Transaksi ditutup.' });
  } catch (err) { next(err); }
});

module.exports = router;
