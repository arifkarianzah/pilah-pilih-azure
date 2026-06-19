/* =====================================================
   ROUTES – Admin Dashboard (async sqlite3)
   ===================================================== */
'use strict';
const router = require('express').Router();
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/dashboard', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const [users, petugas, transactions, completed, pending, totalKg, transactionRevenue, carbonSaved, adminIncome] = await Promise.all([
      db.get("SELECT COUNT(*) as c FROM users WHERE role = 'user'"),
      db.get("SELECT COUNT(*) as c FROM users WHERE role = 'petugas'"),
      db.get("SELECT COUNT(*) as c FROM transactions"),
      db.get("SELECT COUNT(*) as c FROM transactions WHERE status = 'completed'"),
      db.get("SELECT COUNT(*) as c FROM transactions WHERE status IN ('pending','confirmed','on_way')"),
      db.get("SELECT COALESCE(SUM(weight_kg),0) as s FROM transactions WHERE status='completed'"),
      db.get("SELECT COALESCE(SUM(total_price),0) as s FROM transactions WHERE status='completed'"),
      db.get("SELECT COALESCE(SUM(carbon_saved),0) as s FROM user_profiles"),
      db.get("SELECT COALESCE(SUM(amount),0) as s FROM admin_income"),
    ]);

    const totalRevenue = { s: transactionRevenue.s + adminIncome.s };

    const monthly = await db.all(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as total_orders,
             COALESCE(SUM(weight_kg),0) as total_kg, COALESCE(SUM(total_price),0) as total_revenue
      FROM transactions WHERE status='completed' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month ASC
    `);

    const topCategories = await db.all(`
      SELECT wc.name, wc.icon, COUNT(t.id) as count,
             COALESCE(SUM(t.weight_kg),0) as total_kg, COALESCE(SUM(t.total_price),0) as total_revenue
      FROM transactions t JOIN waste_categories wc ON t.category_id = wc.id
      WHERE t.status='completed' GROUP BY t.category_id ORDER BY count DESC LIMIT 6
    `);

    const recentUsers = await db.all(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5'
    );

    res.json({ success: true, data: {
      stats: {
        users: users.c, petugas: petugas.c, transactions: transactions.c,
        completed: completed.c, pending: pending.c,
        total_kg: totalKg.s, total_revenue: totalRevenue.s, carbon_saved: carbonSaved.s
      },
      monthly_trend: monthly,
      top_categories: topCategories,
      recent_users: recentUsers
    }});
  } catch (err) { next(err); }
});

router.get('/reports', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { from, to, type = 'transaction' } = req.query;
    const dateFrom = from || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
    const dateTo   = to   || new Date().toISOString().split('T')[0];

    let data;
    if (type === 'transaction') {
      data = await db.all(
        `SELECT t.*, u.name as user_name, p.name as petugas_name, wc.name as category_name, wc.icon
         FROM transactions t LEFT JOIN users u ON t.user_id = u.id
         LEFT JOIN users p ON t.petugas_id = p.id LEFT JOIN waste_categories wc ON t.category_id = wc.id
         WHERE date(t.created_at) BETWEEN ? AND ? ORDER BY t.created_at DESC LIMIT 500`,
        [dateFrom, dateTo]
      );
    } else if (type === 'revenue') {
      data = await db.all(
        `SELECT date(created_at) as date, COUNT(*) as orders,
         SUM(weight_kg) as kg, SUM(total_price) as revenue, SUM(points_earned) as points
         FROM transactions WHERE status='completed' AND date(created_at) BETWEEN ? AND ?
         GROUP BY date ORDER BY date ASC`, [dateFrom, dateTo]
      );
    } else {
      data = await db.all(
        `SELECT u.id, u.name, u.email, u.role, u.city, u.created_at,
         p.level, p.points, p.total_sold_kg, p.total_income, p.wallet_balance
         FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id
         WHERE date(u.created_at) BETWEEN ? AND ? ORDER BY u.created_at DESC`, [dateFrom, dateTo]
      );
    }
    res.json({ success: true, data, summary: { from: dateFrom, to: dateTo, count: data.length } });
  } catch (err) { next(err); }
});

router.get('/petugas-stats', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const stats = await db.all(`
      SELECT u.id, u.name, u.email, u.role, u.phone, u.city, u.address, u.created_at,
             COUNT(t.id) as total_pickups,
             SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) as completed,
             AVG(pk.rating) as avg_rating,
             COALESCE(SUM(t.weight_kg),0) as total_kg
      FROM users u
      LEFT JOIN transactions t ON t.petugas_id = u.id
      LEFT JOIN pickups pk ON pk.petugas_id = u.id
      WHERE u.role = 'petugas' GROUP BY u.id ORDER BY completed DESC
    `);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

router.get('/bank-stats', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const stats = await db.all(`
      SELECT u.id, u.name, u.email, u.role, u.phone, u.city, u.address, u.created_at,
             COALESCE(p.total_sold_kg, 0) as total_kg
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.role = 'bank_sampah'
    `);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

router.get('/smartcity', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // Mocking smartcity data since there's no actual smartcity table,
    // Or we can derive from pickups. We'll use static robust mock for now based on Pekanbaru.
    const hotspots = [
      { id: 1, lat: 0.5203, lng: 101.4485, capacity: 92, label: 'TPS Sudirman', status: 'kritis' },
      { id: 2, lat: 0.5694, lng: 101.4361, capacity: 78, label: 'TPS Rumbai', status: 'penuh' },
      { id: 3, lat: 0.4632, lng: 101.3857, capacity: 54, label: 'TPS Panam', status: 'sedang' },
      { id: 4, lat: 0.4501, lng: 101.4452, capacity: 21, label: 'TPS Marpoyan', status: 'aman' },
      { id: 5, lat: 0.4900, lng: 101.4200, capacity: 0, label: 'Armada 04 Aktif', status: 'petugas' },
    ];
    const stats = {
      tps_kritis: 2,
      petugas_aktif: 48,
      volume_hari_ini: '14.2T'
    };
    res.json({ success: true, data: { hotspots, stats } });
  } catch (err) { next(err); }
});

router.get('/articles', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const articles = await db.all('SELECT * FROM articles ORDER BY created_at DESC');
    res.json({ success: true, data: articles });
  } catch (err) { next(err); }
});

router.get('/notifications', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const notifs = await db.all("SELECT * FROM notifications WHERE type IN ('alert', 'info', 'pickup', 'wallet') ORDER BY created_at DESC LIMIT 20");
    res.json({ success: true, data: notifs });
  } catch (err) { next(err); }
});

router.delete('/users/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    // Database has ON DELETE CASCADE configured for foreign keys
    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) { next(err); }
});

router.put('/categories/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { price_per_kg } = req.body;
    if (!price_per_kg) return res.status(400).json({ success: false, error: 'Price is required' });
    
    await db.run('UPDATE waste_categories SET price_per_kg = ? WHERE id = ?', [price_per_kg, id]);
    
    // Also record in price_history
    await db.run('INSERT INTO price_history (category_id, price_per_kg, changed_by) VALUES (?, ?, ?)', [id, price_per_kg, req.user.id]);
    
    res.json({ success: true, message: 'Harga berhasil diupdate' });
  } catch (err) { next(err); }
});

router.post('/rewards', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name, cost_points, stock, icon, category } = req.body;
    if (!name || !cost_points) return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    
    const result = await db.run(
      'INSERT INTO rewards (name, cost_points, stock, icon, category) VALUES (?, ?, ?, ?, ?)',
      [name, cost_points, stock || 100, icon || '🎁', category || 'other']
    );
    res.status(201).json({ success: true, message: 'Reward berhasil ditambahkan', data: { id: result.lastID } });
  } catch (err) { next(err); }
});

router.post('/income', authenticate, async (req, res, next) => {
  try {
    const { amount, description, method } = req.body;
    if (!amount) return res.status(400).json({ success: false, message: 'Amount is required' });
    
    // We allow petugas to POST to this when they pay kemitraan
    const petugas_id = req.user.id;
    
    const result = await db.run(
      'INSERT INTO admin_income (petugas_id, amount, description, method) VALUES (?, ?, ?, ?)',
      [petugas_id, amount, description, method]
    );
    res.status(201).json({ success: true, message: 'Income recorded successfully', data: { id: result.lastID } });
  } catch (err) { next(err); }
});

module.exports = router;
