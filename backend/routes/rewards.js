/* =====================================================
   ROUTES – Rewards (async sqlite3)
   ===================================================== */
'use strict';
const router = require('express').Router();
const db = require('../database/db');
const { uuidv4 } = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM rewards WHERE is_active = 1 AND stock > 0';
    const params = [];
    if (category) { query += ' AND category = ?'; params.push(category); }
    query += ' ORDER BY cost_points ASC';

    const rewards  = await db.all(query, params);
    const profile  = await db.get('SELECT points FROM user_profiles WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, data: rewards, user_points: profile?.points || 0 });
  } catch (err) { next(err); }
});

router.get('/redemptions/me', authenticate, async (req, res, next) => {
  try {
    const redemptions = await db.all(
      `SELECT rr.*, r.name as reward_name, r.icon as reward_icon, r.category
       FROM reward_redemptions rr JOIN rewards r ON rr.reward_id = r.id
       WHERE rr.user_id = ? ORDER BY rr.redeemed_at DESC LIMIT 50`, [req.user.id]
    );
    res.json({ success: true, data: redemptions });
  } catch (err) { next(err); }
});

router.get('/redemptions', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = `SELECT rr.*, u.name as user_name, u.email, r.name as reward_name, r.icon, r.category
                 FROM reward_redemptions rr JOIN users u ON rr.user_id = u.id JOIN rewards r ON rr.reward_id = r.id WHERE 1=1`;
    const params = [];
    if (status) { query += ' AND rr.status = ?'; params.push(status); }
    query += ' ORDER BY rr.redeemed_at DESC LIMIT 100';
    const data = await db.all(query, params);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/:id/redeem', authenticate, authorize('user'), async (req, res, next) => {
  try {
    const reward = await db.get('SELECT * FROM rewards WHERE id = ? AND is_active = 1 AND stock > 0', [req.params.id]);
    if (!reward) return res.status(404).json({ success: false, message: 'Reward tidak tersedia.' });

    const profile = await db.get('SELECT * FROM user_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile || profile.points < reward.cost_points) {
      return res.status(400).json({ success: false, message: `Poin tidak cukup. Poin Anda: ${profile?.points||0}, dibutuhkan: ${reward.cost_points}` });
    }

    await db.run('UPDATE user_profiles SET points = points - ? WHERE user_id = ?', [reward.cost_points, req.user.id]);
    await db.run('UPDATE rewards SET stock = stock - 1 WHERE id = ?', [reward.id]);
    const rrId = uuidv4();
    await db.run('INSERT INTO reward_redemptions (id,user_id,reward_id,cost_points) VALUES (?,?,?,?)',
      [rrId, req.user.id, reward.id, reward.cost_points]);
    await db.run('INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)',
      [uuidv4(), req.user.id, `🎁 ${reward.name} Ditukar!`, `-${reward.cost_points} poin. Sedang diproses.`, 'reward']);

    const updatedProfile = await db.get('SELECT points FROM user_profiles WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, message: `${reward.name} berhasil ditukar!`, data: { remaining_points: updatedProfile.points } });
  } catch (err) { next(err); }
});

router.patch('/redemptions/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['processing','completed','failed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }
    const rr = await db.get('SELECT * FROM reward_redemptions WHERE id = ?', [req.params.id]);
    if (!rr) return res.status(404).json({ success: false, message: 'Redemption tidak ditemukan.' });

    await db.run('UPDATE reward_redemptions SET status = ? WHERE id = ?', [status, req.params.id]);
    if (status === 'failed') {
      await db.run('UPDATE user_profiles SET points = points + ? WHERE user_id = ?', [rr.cost_points, rr.user_id]);
      await db.run('UPDATE rewards SET stock = stock + 1 WHERE id = ?', [rr.reward_id]);
      await db.run('INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)',
        [uuidv4(), rr.user_id, '❌ Penukaran Gagal', `Poin ${rr.cost_points} dikembalikan.`, 'error']);
    }
    res.json({ success: true, message: 'Status diperbarui.' });
  } catch (err) { next(err); }
});

module.exports = router;
